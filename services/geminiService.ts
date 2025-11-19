
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Source, SearchResult, AgentTask, Message } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize the client
const ai = new GoogleGenAI({ apiKey });

const SEARCH_MODEL = "gemini-2.5-flash";
const PLANNER_MODEL = "gemini-2.5-flash";

/**
 * Parses the grounding metadata from the Gemini response to extract usable source links.
 */
const extractSources = (response: GenerateContentResponse): Source[] => {
  const sources: Source[] = [];
  
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) return sources;

  const groundingMetadata = candidates[0].groundingMetadata;
  if (!groundingMetadata) return sources;

  const chunks = groundingMetadata.groundingChunks;
  if (!chunks) return sources;

  chunks.forEach((chunk) => {
    if (chunk.web) {
      sources.push({
        title: chunk.web.title || "Web Source",
        url: chunk.web.uri || "#",
        snippet: "", // Google Search Grounding often doesn't provide snippets in chunks, handled in text sometimes
        source: new URL(chunk.web.uri || "https://google.com").hostname.replace('www.', '')
      });
    }
  });

  // Filter duplicates based on URL
  return sources.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);
};

/**
 * Step 1: PLAN
 * Orchestrates a team of specialized agents based on the user query.
 * Now accepts history to handle follow-up questions contextually.
 */
export const planResearch = async (query: string, history: Message[] = []): Promise<AgentTask[]> => {
  try {
    // Format history for the planner
    const historyContext = history.length > 0 
      ? history.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')
      : "No previous conversation.";

    const response = await ai.models.generateContent({
      model: PLANNER_MODEL,
      contents: `
      Conversation History:
      ---
      ${historyContext}
      ---

      Current User Query: "${query}"
      
      You are a Chief AI Orchestrator. Your goal is to analyze this query and create a team of 1 to 4 specialized AI Agents to research different aspects of it.
      
      CRITICAL:
      - Use the Conversation History to resolve ambiguous references (e.g., "what about the second one?", "compare it to X").
      - If the user asks a follow-up question, create tasks that specifically address the new angle while keeping the previous context in mind.
      
      Example: If user asks "Should I buy stock X or Y?", create:
      1. "Financial Analyst" to look at numbers.
      2. "Market Researcher" to look at news/sentiment.
      
      Determine if there are dependencies. For example, if the "Market Researcher" needs to know the stock price first, make it dependent on the "Financial Analyst".
      
      Return the agent team and their tasks in JSON format. IDs should be simple strings like "task-1", "task-2".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Unique ID (e.g., 'task-1')" },
              agentRole: { type: Type.STRING, description: "The persona of the agent (e.g., 'Senior Python Dev', 'Historian', 'Travel Planner')" },
              description: { type: Type.STRING, description: "The specific expertise or capabilities of this agent (e.g., 'Expert in 19th century European history')." },
              title: { type: Type.STRING, description: "Short title of the task" },
              goal: { type: Type.STRING, description: "Specific instruction for this agent on what to find. Ensure it is self-contained." },
              dependencies: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }, 
                description: "List of task IDs that must be completed BEFORE this task can start." 
              }
            },
            required: ["id", "agentRole", "title", "goal"]
          }
        }
      }
    });

    const tasks = JSON.parse(response.text || "[]");
    // Ensure dependencies is always an array and status is pending
    return tasks.map((t: any) => ({ 
        ...t, 
        status: 'pending',
        dependencies: t.dependencies || []
    }));
  } catch (error) {
    console.error("Planning Error:", error);
    // Fallback to single task
    return [{ 
        id: 'task-fallback', 
        agentRole: 'Research Assistant', 
        description: 'General purpose researcher',
        title: 'General Research', 
        goal: `Find information about: ${query}`,
        status: 'pending',
        dependencies: []
    }];
  }
};

/**
 * Step 2: EXECUTE
 * performs the research task using the specific Agent Persona.
 * Accepts sharedContext to allow agents to see previous findings.
 */
export const executeResearchTask = async (
    task: AgentTask, 
    sharedContext: string = ""
): Promise<SearchResult> => {
  try {
    const systemInstruction = `You are a specialized AI Agent with the role: ${task.agentRole}.
    ${task.description ? `Your Expertise/Capabilities: ${task.description}` : ''}
    
    Your specific Goal: ${task.goal}
    
    You are part of a collaborative research team. 
    ${sharedContext ? `
    IMPORTANT - TEAM CONTEXT (Findings from other agents):
    The following information has already been gathered by your team members. 
    Use this context to inform your search, avoid redundancy, and build upon their work.
    If their findings answer part of your goal, cite them (e.g. "As the Financial Analyst found...").
    
    --- START OF TEAM CONTEXT ---
    ${sharedContext}
    --- END OF TEAM CONTEXT ---
    ` : ''}
    
    Use Google Search to find high-quality, factual information. 
    Do not hallucinate. Rely on the search results.
    Summarize your findings clearly for the Chief Orchestrator. Use structured formatting (bullet points, headers) to make it easy to read.
    `;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: `Perform your assigned task: ${task.goal}`,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No information found.";
    const sources = extractSources(response);

    return { text, sources };

  } catch (error: any) {
    console.error(`Task Execution Error (${task.title}):`, error);
    return { text: "Failed to retrieve information for this task.", sources: [] };
  }
};

/**
 * Step 3: SYNTHESIZE
 * Combines results from multiple specialized agents into a final comprehensive answer.
 */
export const synthesizeReport = async (
  query: string, 
  agentResults: { task: AgentTask, result: SearchResult }[],
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<SearchResult> => {
  
  try {
    // Aggregate all text contexts with Agent attribution
    const researchContext = agentResults.map(item => {
      return `## Input from ${item.task.agentRole} (Task: ${item.task.title})\n\n${item.result.text}\n`;
    }).join("\n---\n");

    // Aggregate all sources
    const allSources: Source[] = [];
    agentResults.forEach(item => {
        allSources.push(...item.result.sources);
    });

    // Remove duplicate sources
    const uniqueSources = allSources.filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);

    const systemInstruction = `You are SparkAgent, the Chief AI Synthesizer.
    User Query: "${query}"
    
    You have received detailed reports from your team of specialized agents.
    Your job is to synthesize these into a single, highly organized, and easy-to-read answer.
    
    # FORMATTING GUIDELINES (CRITICAL):
    1. **Executive Summary**: Start with a direct, high-level answer to the query (2-3 sentences).
    2. **Structured Sections**: Use clear ## Headings to separate different sub-topics.
    3. **Readability**: 
       - Use **bullet points** for lists.
       - Use **Markdown tables** for comparisons or complex data.
       - **Avoid** long walls of text. Keep paragraphs short (max 3-4 lines).
       - Use **bold text** for key terms.
    4. **Synthesis**: Integrate the agent findings smoothly. You can say "Financial analysis shows..." but focus on the facts.
    5. **Conclusion**: End with a brief concluding summary or recommendation.

    Make the final output look professional, clean, and arranged for quick reading. Output pure Markdown.
    `;

    let contents: any = [];
    history.forEach(msg => contents.push({ role: msg.role, parts: msg.parts }));
    
    // Add the research context as part of the prompt logic
    contents.push({
      role: 'user',
      parts: [{ text: `Here are the findings from your agent team:\n\n${researchContext}\n\nPlease provide the final arranged answer to my query: "${query}"` }]
    });

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: contents,
      config: { systemInstruction },
    });

    return {
      text: response.text || "Could not synthesize response.",
      sources: uniqueSources
    };

  } catch (error: any) {
    console.error("Synthesis Error:", error);
    throw new Error("Failed to synthesize final report.");
  }
};
