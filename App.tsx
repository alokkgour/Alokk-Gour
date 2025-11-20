
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  ArrowRight, 
  Sparkles, 
  MessageSquarePlus, 
  Menu, 
  X,
  History,
  Github,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  BrainCircuit,
  Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { planResearch, executeResearchTask, synthesizeReport } from './services/geminiService';
import { Message, AgentState, Thread, AgentTask, SearchResult } from './types';
import { SourceCard } from './components/SourceCard';
import { ThinkingIndicator } from './components/ThinkingIndicator';

// Predefined suggestion pills
const SUGGESTIONS = [
  "Compare iPhone 15 Pro and Samsung S24 Ultra",
  "Investigate the future of AI Agents in 2025",
  "Plan a 3-day Tokyo trip for a foodie & historian",
  "Analyze the financial impact of quantum computing",
];

// Mock initial threads for fallback
const INITIAL_THREADS: Thread[] = [
    { 
        id: 'demo-1', 
        title: 'Quantum Computing Basics', 
        messages: [
            { id: '1', role: 'user', content: 'Explain quantum computing basics' },
            { id: '2', role: 'model', content: 'Quantum computing uses quantum mechanics to process information...' }
        ],
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
    }
];

// Declare Prism globally for TS
declare const Prism: any;

// Custom Pre Block Component (Window Chrome for Code)
const PreBlock = ({ children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const preRef = useRef<HTMLPreElement>(null);
  
    const handleCopy = () => {
      if (preRef.current) {
        const codeText = preRef.current.innerText;
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };
  
    return (
      <div className="my-5 rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117] shadow-lg group ring-1 ring-white/5">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800/50 backdrop-blur">
          <div className="flex gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
             <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
          <button 
            onClick={handleCopy}
            className="text-xs font-medium text-slate-400 hover:text-brand-300 transition-colors flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50 hover:border-slate-600"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="relative group/code">
            <pre ref={preRef} {...props} className="!m-0 !bg-transparent !p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
               {children}
            </pre>
        </div>
      </div>
    );
  };

// Custom Code Component (Syntax Highlighting)
const CodeBlock = ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeRef = useRef<HTMLElement>(null);
    
    useEffect(() => {
        if (match && codeRef.current && typeof Prism !== 'undefined') {
            Prism.highlightElement(codeRef.current);
        }
    }, [children, className]);

    if (!match) {
        return (
            <code className="bg-slate-800/50 text-brand-200 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-700/50" {...props}>
                {children}
            </code>
        );
    }
    
    return (
        <code ref={codeRef} className={`${className} !bg-transparent !p-0 !text-sm font-mono`} {...props}>
            {children}
        </code>
    );
};

function App() {
  const [query, setQuery] = useState('');
  const [currentQueryString, setCurrentQueryString] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  
  // Task State Management
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([]);
  // We use a ref for the task runner to always access the latest priorities
  const tasksRef = useRef<AgentTask[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // History / Thread Management - Load from LocalStorage
  const [threads, setThreads] = useState<Thread[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sparkagent_threads');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Rehydrate Date objects
                return parsed.map((t: any) => ({
                    ...t,
                    updatedAt: new Date(t.updatedAt)
                }));
            } catch (e) {
                console.error("Failed to load threads", e);
            }
        }
    }
    return INITIAL_THREADS;
  });
  
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  // Save threads to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem('sparkagent_threads', JSON.stringify(threads));
  }, [threads]);

  // Ref for scrolling to bottom of chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Only scroll if we are active in a chat
    if (messages.length > 0) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentState, activeTasks]);

  // Sync current messages to the active thread
  useEffect(() => {
    if (activeThreadId && messages.length > 0) {
        setThreads(prev => prev.map(t => 
            t.id === activeThreadId 
                ? { ...t, messages, updatedAt: new Date() } 
                : t
        ));
    }
  }, [messages, activeThreadId]);

  const startNewResearch = () => {
      setActiveThreadId(null);
      setMessages([]);
      setQuery('');
      setCurrentQueryString('');
      setAgentState(AgentState.IDLE);
      setActiveTasks([]);
      setSidebarOpen(false);
      tasksRef.current = [];
  };

  const switchToThread = (thread: Thread) => {
      setActiveThreadId(thread.id);
      setMessages(thread.messages);
      setAgentState(AgentState.IDLE);
      setActiveTasks([]);
      tasksRef.current = [];
      setSidebarOpen(false);
  };

  const deleteThread = (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) {
          startNewResearch();
      }
  };

  const toggleTaskPriority = (taskId: string) => {
    const update = (tasks: AgentTask[]) => 
        tasks.map(t => 
            t.id === taskId && t.status === 'pending' 
            ? { ...t, priority: (t.priority === 'high' ? 'normal' : 'high') as 'normal' | 'high' } 
            : t
        );

    tasksRef.current = update(tasksRef.current);
    setActiveTasks(prev => update(prev));
  };

  // --- Review Phase Handlers ---

  const handleUpdateTask = (taskId: string, updates: Partial<AgentTask>) => {
    const update = (tasks: AgentTask[]) => tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    tasksRef.current = update(tasksRef.current);
    setActiveTasks(prev => update(prev));
  };

  const handleAddTask = () => {
    const newTask: AgentTask = {
        id: `task-custom-${Date.now()}`,
        title: "New Custom Task",
        agentRole: "Custom Agent",
        description: "", // New: Expertise field
        goal: "Describe what this agent should do...",
        status: 'pending',
        priority: 'normal',
        dependencies: [] // Init with empty deps
    };
    tasksRef.current = [...tasksRef.current, newTask];
    setActiveTasks(prev => [...prev, newTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    // Also remove this task ID from other tasks' dependencies
    const update = (tasks: AgentTask[]) => 
        tasks.filter(t => t.id !== taskId)
             .map(t => ({
                 ...t,
                 dependencies: t.dependencies?.filter(d => d !== taskId) || []
             }));

    tasksRef.current = update(tasksRef.current);
    setActiveTasks(prev => update(prev));
  };

  // 2. EXECUTE & SYNTHESIZE
  const handleStartExecution = async () => {
    setAgentState(AgentState.SEARCHING);

    const taskResultsMap = new Map<string, SearchResult>();
    const MAX_CONCURRENCY = 2; 

    const updateStatus = (id: string, status: AgentTask['status']) => {
      const update = (list: AgentTask[]) => list.map(t => t.id === id ? { ...t, status } : t);
      tasksRef.current = update(tasksRef.current);
      setActiveTasks(prev => update(prev));
    };

    const processQueue = async () => {
       while (true) {
          const currentTasks = tasksRef.current;
          const pending = currentTasks.filter(t => t.status === 'pending');
          const running = currentTasks.filter(t => t.status === 'running');
          const completed = currentTasks.filter(t => t.status === 'completed');

          // Exit if everything is done
          if (pending.length === 0 && running.length === 0) {
              break;
          }
          
          // Find executable tasks (dependencies met)
          const executableTasks = pending.filter(t => {
              if (!t.dependencies || t.dependencies.length === 0) return true;
              // Check if all dependency IDs exist in completed array
              return t.dependencies.every(depId => completed.some(c => c.id === depId));
          });

          if (running.length < MAX_CONCURRENCY && executableTasks.length > 0) {
              // Pick high priority first, then normal
              const nextTask = executableTasks.find(t => t.priority === 'high') || executableTasks[0];

              if (nextTask) {
                  updateStatus(nextTask.id, 'running');
                  
                  // BUILD CONTEXT (COLLABORATION)
                  // Enhance collaboration by including Goal and Title clearly
                  const contextString = completed.map(t => {
                      const result = taskResultsMap.get(t.id);
                      return `[Context from Agent: ${t.agentRole} (Task: ${t.title})]:
Goal: ${t.goal}
Findings: ${result?.text || 'No info'}`;
                  }).join('\n\n---\n\n');
                  
                  executeResearchTask(nextTask, contextString).then(result => {
                      taskResultsMap.set(nextTask.id, result);
                      updateStatus(nextTask.id, 'completed');
                      // Recursive call to check for next available tasks immediately
                      processQueue();
                  });
              }
          } else if (pending.length > 0 && running.length === 0 && executableTasks.length === 0) {
               // Deadlock detection or waiting? 
               console.warn("Potential Deadlock: Pending tasks exist but none are executable and nothing is running.");
               break; 
          } else if (running.length >= MAX_CONCURRENCY) {
              // Max concurrency reached, wait for something to finish
              return;
          } else {
             // Nothing executable right now, wait.
             return;
          }
          
          // Small delay to prevent hot loop if promises resolve instantly
          await new Promise(r => setTimeout(r, 50));
       }
    };

    try {
        // Start the processor
        await processQueue();

        // Wait for all to complete
        while (tasksRef.current.some(t => t.status !== 'completed' && t.status !== 'failed')) {
            await new Promise(r => setTimeout(r, 200));
        }

        const finalResults = tasksRef.current.map(task => ({
            task,
            result: taskResultsMap.get(task.id) || { text: "Failed", sources: [] }
        }));

        // 3. SYNTHESIZE
        setAgentState(AgentState.SYNTHESIZING);
        
        // Prepare history for the synthesizer
        // If called immediately from handleSearch, 'messages' is the history (excludes current query).
        // If called from a re-render, it might include the query.
        // We remove the query if it's the last message to avoid duplication in synthesis prompt.
        let historyForApi = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));

        if (historyForApi.length > 0 && currentQueryString) {
             const lastMsg = historyForApi[historyForApi.length - 1];
             if (lastMsg.parts[0].text === currentQueryString) {
                 historyForApi = historyForApi.slice(0, -1);
             }
        }

        const finalResult = await synthesizeReport(currentQueryString, finalResults, historyForApi);
        
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: finalResult.text,
          sources: finalResult.sources,
          agentTasks: tasksRef.current // Save the executed agent state to the message
        };

        setMessages(prev => [...prev, modelMsg]);
        setAgentState(AgentState.IDLE);
        setCurrentQueryString(''); 

    } catch (error) {
        console.error("Execution Error:", error);
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: 'model',
          content: "I encountered an error while executing the plan. Please try again.",
        };
        setMessages(prev => [...prev, errorMsg]);
        setAgentState(AgentState.ERROR);
    }
  };

  // --- Main Orchestration Logic ---

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const initialQuery = searchQuery;
    
    // Capture history BEFORE adding the new user message to state
    // This acts as the "conversation context" for the Planner
    const historyForPlanner = messages; 

    setQuery(''); 
    setCurrentQueryString(initialQuery);
    setActiveTasks([]);
    tasksRef.current = [];
    
    // Trigger Planning UI State
    setAgentState(AgentState.PLANNING);
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: initialQuery,
    };
    
    // Initialize Thread if needed
    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
        currentThreadId = Date.now().toString();
        const newThread: Thread = {
            id: currentThreadId,
            title: initialQuery,
            messages: [userMsg],
            updatedAt: new Date()
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(currentThreadId);
        setMessages([userMsg]);
    } else {
        setMessages(prev => [...prev, userMsg]);
    }

    try {
      // 1. PLAN
      // Pass the history so the planner understands context (e.g. "compare it to the previous one")
      const plannedTasks = await planResearch(initialQuery, historyForPlanner);
      
      // Initialize tasks with normal priority
      const initialTasks = plannedTasks.map(t => ({ ...t, priority: 'normal' as const }));
      
      setActiveTasks(initialTasks);
      tasksRef.current = initialTasks;
      
      // AUTO START: Skip REVIEWING state and go straight to execution
      handleStartExecution();

    } catch (error) {
      console.error(error);
      setAgentState(AgentState.ERROR);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const filteredThreads = threads.filter(t => 
      t.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  // --- Render Helpers ---

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in zoom-in duration-500">
      <div className="mb-8 relative">
        <div className="absolute -inset-4 bg-brand-500/20 blur-xl rounded-full animate-pulse-slow"></div>
        <Sparkles className="w-16 h-16 text-brand-400 relative z-10" />
      </div>
      
      <h1 className="text-4xl md:text-6xl font-bold text-center bg-gradient-to-r from-white via-brand-100 to-brand-300 text-transparent bg-clip-text mb-6 tracking-tight">
        What do you want to know?
      </h1>
      
      <div className="w-full max-w-2xl relative group z-20">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500"></div>
        <div className="relative flex items-center bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
          <div className="pl-4">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (e.g. 'Plan a Tokyo Trip')"
            className="w-full bg-transparent border-none px-4 py-4 text-lg text-white placeholder-slate-500 focus:ring-0 focus:outline-none"
            autoFocus
          />
          <button 
            onClick={() => handleSearch(query)}
            className="mr-2 p-2 bg-slate-800 hover:bg-brand-600 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-3xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSearch(s)}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-full text-sm text-slate-300 hover:text-brand-200 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    
    if (isUser) {
      return (
        <div key={msg.id} className="flex justify-end mb-8">
          <div className="bg-slate-800 text-slate-100 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[80%] text-lg shadow-sm border border-slate-700">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Sources Section */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-mono uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Sources found</span>
            </div>
            <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {msg.sources.map((source, idx) => (
                <SourceCard key={idx} source={source} index={idx} />
              ))}
            </div>
          </div>
        )}

        {/* Saved Agent Work Visualization (Collapsible) */}
        {msg.agentTasks && msg.agentTasks.length > 0 && (
           <div className="mb-6 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
               <details className="group">
                   <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors">
                       <div className="flex items-center gap-2 text-sm font-medium text-slate-400 group-hover:text-brand-300">
                           <BrainCircuit className="w-4 h-4" />
                           <span>View Research Process ({msg.agentTasks.length} Agents)</span>
                       </div>
                       <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
                   </summary>
                   <div className="px-4 pb-6 pt-2 bg-slate-950/50 border-t border-slate-800/50">
                       <ThinkingIndicator 
                           state={AgentState.COMPLETE} 
                           tasks={msg.agentTasks}
                           className="my-0 transform scale-95 origin-top" 
                       />
                   </div>
               </details>
           </div>
        )}

        {/* Main Content */}
        <div className="flex gap-4 md:gap-6">
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
             <div className="prose prose-invert prose-slate max-w-none prose-headings:text-slate-100 prose-a:text-brand-400 prose-strong:text-slate-100 text-slate-300 leading-relaxed">
                <ReactMarkdown
                    components={{
                        a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                        table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-700"><table className="w-full text-left text-sm" {...props} /></div>,
                        thead: ({node, ...props}) => <thead className="bg-slate-800/50 text-slate-200" {...props} />,
                        th: ({node, ...props}) => <th className="px-4 py-3 font-semibold border-b border-slate-700" {...props} />,
                        td: ({node, ...props}) => <td className="px-4 py-3 border-b border-slate-800" {...props} />,
                        pre: PreBlock,
                        code: CodeBlock
                    }}
                >
                    {msg.content}
                </ReactMarkdown>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 min-h-screen font-sans text-slate-200 flex">
      
      {/* Sidebar (Mobile & Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative
        flex flex-col
      `}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">SparkAgent</span>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden ml-auto text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={startNewResearch}
            className="flex items-center gap-3 w-full px-4 py-3 bg-brand-600/10 hover:bg-brand-600/20 text-brand-300 rounded-xl border border-brand-500/20 hover:border-brand-500/50 transition-all mb-4"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span className="text-sm font-medium">New Research</span>
          </button>
          
          {/* Search History Input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
                type="text"
                placeholder="Filter history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-all"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-2 scrollbar-hide">
            <div className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recents</div>
            
            <div className="space-y-0.5">
               {filteredThreads.length === 0 ? (
                   <div className="text-center py-4 text-xs text-slate-600 italic">
                       No research found
                   </div>
               ) : (
                   filteredThreads.map(thread => (
                       <div 
                            key={thread.id}
                            onClick={() => switchToThread(thread)}
                            className={`
                                group flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-all
                                ${activeThreadId === thread.id ? 'bg-slate-800 text-brand-100 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
                            `}
                       >
                            <History className={`w-3.5 h-3.5 flex-shrink-0 ${activeThreadId === thread.id ? 'text-brand-400' : 'text-slate-600 group-hover:text-slate-500'}`} />
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="truncate font-medium leading-tight">{thread.title}</span>
                            </div>
                            {/* Delete Button */}
                            <button 
                                onClick={(e) => deleteThread(e, thread.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-all"
                                title="Delete history"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                       </div>
                   ))
               )}
            </div>
        </div>

        <div className="mt-auto border-t border-slate-800 p-4">
             <a href="#" className="flex items-center gap-2 text-xs text-slate-500 hover:text-brand-400 transition-colors">
                <Github className="w-3 h-3" />
                <span>View Source</span>
             </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Header (Mobile) */}
        <header className="md:hidden h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-950/80 backdrop-blur-sm z-40">
           <button onClick={() => setSidebarOpen(true)} className="text-slate-400">
             <Menu className="w-5 h-5" />
           </button>
           <span className="font-bold text-white">SparkAgent</span>
           <button onClick={startNewResearch} className="text-brand-400">
             <MessageSquarePlus className="w-5 h-5" />
           </button>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-8" id="scroll-container">
          <div className="max-w-4xl mx-auto h-full">
            
            {!activeThreadId && messages.length === 0 ? (
              renderWelcome()
            ) : (
              <div className="pb-32 pt-4">
                {messages.map(msg => renderMessage(msg))}
                
                {/* Thinking State with Agent Visualization */}
                {agentState !== AgentState.IDLE && agentState !== AgentState.ERROR && (
                   <div className="ml-0 md:ml-14 mb-12 animate-in fade-in slide-in-from-bottom-2">
                       <ThinkingIndicator 
                           state={agentState} 
                           tasks={activeTasks} 
                           onTogglePriority={agentState === AgentState.SEARCHING ? toggleTaskPriority : undefined}
                           onUpdateTask={agentState === AgentState.REVIEWING ? handleUpdateTask : undefined}
                           onAddTask={agentState === AgentState.REVIEWING ? handleAddTask : undefined}
                           onDeleteTask={agentState === AgentState.REVIEWING ? handleDeleteTask : undefined}
                           onStart={agentState === AgentState.REVIEWING ? handleStartExecution : undefined}
                       />
                   </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
            )}

          </div>
        </div>

        {/* Sticky Input Area */}
        {(activeThreadId || messages.length > 0) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-30">
            <div className="max-w-3xl mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex items-center bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
                    <input 
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a follow-up question..."
                        className="w-full bg-transparent border-none px-4 py-4 text-base text-white placeholder-slate-500 focus:ring-0 focus:outline-none"
                        disabled={agentState !== AgentState.IDLE && agentState !== AgentState.ERROR}
                    />
                    <button 
                        onClick={() => handleSearch(query)}
                        disabled={!query.trim() || (agentState !== AgentState.IDLE && agentState !== AgentState.ERROR)}
                        className="mr-2 p-2 bg-slate-800 hover:bg-brand-600 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {agentState !== AgentState.IDLE && agentState !== AgentState.ERROR ? (
                           <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <ArrowRight className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-600">
                        SparkAgent can make mistakes. Check sources.
                    </p>
                </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
