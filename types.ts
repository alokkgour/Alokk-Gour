
export interface Source {
  title: string;
  url: string;
  snippet?: string;
  source?: string; // e.g. "Wikipedia"
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: Source[];
  isThinking?: boolean; // For UI state
  thinkingCurrentStep?: string; // Legacy single-step thinking
  agentTasks?: AgentTask[]; // For multi-agent UI state
}

export enum AgentState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  REVIEWING = 'REVIEWING', // NEW: Human-in-the-loop state
  SEARCHING = 'SEARCHING',
  ANALYZING = 'ANALYZING',
  SYNTHESIZING = 'SYNTHESIZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface AgentTask {
  id: string;
  title: string; // The specific action/task name
  agentRole: string; // NEW: The specific persona (e.g. "Financial Analyst")
  description?: string; // NEW: The expertise or capabilities of the agent
  goal: string; // NEW: Detailed goal for this agent
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority?: 'normal' | 'high'; // User controlled priority
  dependencies?: string[]; // NEW: Array of Task IDs that must complete before this one starts
  result?: SearchResult;
}

export interface SearchResult {
  text: string;
  sources: Source[];
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}
