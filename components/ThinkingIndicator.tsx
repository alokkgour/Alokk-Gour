
import React from 'react';
import { Loader2, CheckCircle2, XCircle, Bot, BrainCircuit, Layers, Star, Cpu, ArrowDown, Plus, Trash2, Play, Edit3, Link2, Lock } from 'lucide-react';
import { AgentTask, AgentState } from '../types';

interface ThinkingIndicatorProps {
  state: AgentState;
  tasks: AgentTask[];
  onTogglePriority?: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<AgentTask>) => void;
  onAddTask?: () => void;
  onDeleteTask?: (taskId: string) => void;
  onStart?: () => void;
  className?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ 
  state, 
  tasks, 
  onTogglePriority,
  onUpdateTask,
  onAddTask,
  onDeleteTask,
  onStart,
  className
}) => {

  const getStatusStyle = (status: string, isBlocked: boolean) => {
    if (isBlocked) return 'border-slate-700 bg-slate-800/20 text-slate-500';
    switch (status) {
      case 'completed': return 'border-green-500/30 bg-green-900/10 text-green-100';
      case 'running': return 'border-brand-500/50 bg-brand-900/20 text-brand-100 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
      case 'failed': return 'border-red-500/30 bg-red-900/10 text-red-100';
      default: return 'border-slate-700/50 bg-slate-800/30 text-slate-400';
    }
  };

  const getOrchestratorIcon = () => {
    switch (state) {
        case AgentState.PLANNING: return BrainCircuit;
        case AgentState.REVIEWING: return Bot;
        case AgentState.SYNTHESIZING: return Layers;
        case AgentState.SEARCHING: return Cpu;
        default: return Loader2;
    }
  };

  const OrchestratorIcon = getOrchestratorIcon();
  const showBranches = tasks.length > 0;
  const isReviewing = state === AgentState.REVIEWING;

  return (
    <div className={`w-full max-w-4xl mx-auto animate-in fade-in zoom-in duration-500 select-none ${className || 'my-8'}`}>
      
      {/* 1. ORCHESTRATOR NODE (ROOT) */}
      <div className="flex flex-col items-center relative z-20">
        <div className={`
            relative flex items-center gap-4 px-6 py-4 rounded-2xl border 
            ${state === AgentState.COMPLETE ? 'border-green-500/30 bg-green-950/20' : 'border-brand-500/30 bg-slate-900/80 backdrop-blur-md'}
            ${isReviewing ? 'ring-2 ring-brand-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'shadow-2xl'}
            transition-all duration-500 z-20
        `}>
            {/* Pulse Effect */}
            {state !== AgentState.COMPLETE && state !== AgentState.IDLE && state !== AgentState.REVIEWING && (
                <div className="absolute inset-0 bg-brand-500/5 animate-pulse rounded-2xl pointer-events-none"></div>
            )}
            
            <div className={`p-2.5 rounded-xl bg-slate-800 border border-slate-700/50 ${state === AgentState.SEARCHING ? 'animate-pulse' : ''}`}>
                <OrchestratorIcon className={`w-6 h-6 ${state === AgentState.COMPLETE ? 'text-green-400' : 'text-brand-400'}`} />
            </div>
            
            <div className="flex flex-col">
                <span className="text-[10px] font-mono text-brand-300/70 font-bold uppercase tracking-widest mb-0.5">
                    {state === AgentState.PLANNING ? 'System State: Planning' : 
                     state === AgentState.REVIEWING ? 'System State: Review Plan' :
                     state === AgentState.SEARCHING ? 'System State: Active' :
                     state === AgentState.SYNTHESIZING ? 'System State: Processing' : 'System State: Ready'}
                </span>
                <span className="text-sm text-slate-200 font-medium flex items-center gap-2">
                   {state === AgentState.PLANNING && "Analyzing query & assigning agents..."}
                   {state === AgentState.REVIEWING && "Review & Configure agents before execution"}
                   {state === AgentState.SEARCHING && (
                     <>
                        <span>Orchestrating {tasks.length} specialized agents</span>
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 border border-slate-700">
                           {Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)}%
                        </span>
                     </>
                   )}
                   {state === AgentState.SYNTHESIZING && "Compiling agent reports into final answer..."}
                   {(state === AgentState.IDLE || state === AgentState.COMPLETE) && "Research completed successfully"}
                </span>
            </div>

            {/* Review Mode: Start Button */}
            {isReviewing && onStart && (
                <button 
                    onClick={onStart}
                    className="ml-4 flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-brand-500/25 active:scale-95"
                >
                    <Play className="w-4 h-4 fill-current" />
                    Start Research
                </button>
            )}
        </div>

        {/* Vertical connector from Root to Branch Line */}
        {showBranches && (
            <div className={`w-px bg-gradient-to-b from-slate-700 to-slate-800 transition-all duration-500 z-0
                ${state === AgentState.SEARCHING ? 'h-10' : 'h-8'}
            `}></div>
        )}
      </div>

      {/* 2. AGENT TREE STRUCTURE */}
      {showBranches && (
        <div className="relative px-4 z-10">
            
            {/* Tree Layout Container */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 pt-0">
                {tasks.map((task, index) => {
                    const isLast = index === tasks.length - 1;
                    const isFirst = index === 0;
                    const isSingle = tasks.length === 1;

                    // Check if blocked by dependencies (Running mode only)
                    const isBlocked = state === AgentState.SEARCHING && 
                                      task.status === 'pending' && 
                                      (task.dependencies || []).some(depId => tasks.find(t => t.id === depId)?.status !== 'completed');
                    
                    return (
                        <div key={task.id} className="flex flex-col items-center relative flex-1 min-w-[260px] max-w-[320px]">
                             
                             {/* --- CONNECTORS --- */}
                             {tasks.length > 1 && (
                                <div className="w-full h-6 absolute -top-6 pointer-events-none overflow-hidden">
                                    {/* Vertical Line Up from Card */}
                                    <div className="absolute bottom-0 left-1/2 w-px h-full bg-slate-800 -translate-x-1/2"></div>
                                    
                                    {/* Horizontal Connector Bar logic */}
                                    <div className={`absolute top-0 h-px bg-slate-800 
                                        ${isFirst ? 'left-1/2 w-1/2' : ''}
                                        ${isLast ? 'right-1/2 w-1/2' : ''}
                                        ${!isFirst && !isLast ? 'w-full left-0' : ''}
                                    `}></div>
                                </div>
                            )}
                            {/* Single Item Connector */}
                            {isSingle && (
                                <div className="absolute -top-6 left-1/2 w-px h-6 bg-slate-800 -translate-x-1/2"></div>
                            )}


                            {/* --- AGENT CARD --- */}
                            <div className={`
                                relative w-full p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 group flex flex-col
                                ${getStatusStyle(task.status, isBlocked)}
                                ${task.status === 'running' ? 'scale-105 z-10' : ''}
                                ${isReviewing ? 'hover:border-brand-500/30 hover:bg-slate-800/60' : 'hover:bg-slate-800/40'}
                            `}>
                                {/* Header: Role & Icon */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2.5 w-full">
                                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${task.status === 'running' ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-800/80 text-slate-500'}`}>
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        
                                        <div className="flex flex-col min-w-0 flex-1">
                                            {isReviewing && onUpdateTask ? (
                                                <div className="flex flex-col gap-1">
                                                    <input 
                                                        type="text"
                                                        value={task.agentRole}
                                                        onChange={(e) => onUpdateTask(task.id, { agentRole: e.target.value })}
                                                        className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-0.5 text-xs font-bold text-brand-200 focus:outline-none focus:border-brand-500/50 w-full"
                                                        placeholder="Role Name"
                                                    />
                                                    <input 
                                                        type="text"
                                                        value={task.description || ''}
                                                        onChange={(e) => onUpdateTask(task.id, { description: e.target.value })}
                                                        className="bg-transparent border-b border-slate-800 focus:border-brand-500/50 px-0.5 py-0.5 text-[10px] text-slate-400 focus:outline-none w-full placeholder-slate-600"
                                                        placeholder="Expertise (e.g. 'Python Expert')"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">
                                                        Agent Persona
                                                    </span>
                                                    <span className="text-xs font-bold truncate text-slate-200" title={task.agentRole}>
                                                        {task.agentRole}
                                                    </span>
                                                    {task.description && (
                                                        <span className="text-[10px] text-slate-500 truncate" title={task.description}>
                                                            {task.description}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Action: Delete in Review or Priority/Status in Run */}
                                    {isReviewing && onDeleteTask ? (
                                         <button 
                                            onClick={() => onDeleteTask(task.id)}
                                            className="p-1.5 rounded-md text-slate-600 hover:bg-red-900/20 hover:text-red-400 transition-all"
                                            title="Remove Agent"
                                         >
                                            <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                    ) : (
                                        task.status === 'pending' && onTogglePriority ? (
                                            <button 
                                                onClick={() => onTogglePriority(task.id)}
                                                className={`
                                                    p-1.5 rounded-md transition-all
                                                    ${task.priority === 'high' 
                                                        ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/50' 
                                                        : 'text-slate-600 hover:bg-slate-800 hover:text-amber-400'
                                                    }
                                                `}
                                                title="Prioritize Task"
                                            >
                                                <Star className={`w-3.5 h-3.5 ${task.priority === 'high' ? 'fill-amber-400' : ''}`} />
                                            </button>
                                        ) : (
                                            <div className="pt-0.5 pl-2">
                                                {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                                {task.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-brand-400" />}
                                                {task.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                                                {isBlocked && <Lock className="w-4 h-4 text-slate-600" />}
                                            </div>
                                        )
                                    )}
                                </div>
                                
                                {/* Body: Task Title & Goal */}
                                <div className="space-y-2 flex-1 flex flex-col mt-2">
                                    {isReviewing && onUpdateTask ? (
                                        <>
                                           <input 
                                                value={task.title}
                                                onChange={(e) => onUpdateTask(task.id, { title: e.target.value })}
                                                className="bg-slate-900/30 border-none text-xs font-medium text-slate-300 focus:ring-0 w-full px-0"
                                                placeholder="Task Name"
                                            />
                                            <textarea 
                                                value={task.goal}
                                                onChange={(e) => onUpdateTask(task.id, { goal: e.target.value })}
                                                className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1.5 text-xs leading-relaxed text-slate-300 focus:outline-none focus:border-brand-500/50 w-full resize-none min-h-[60px]"
                                                placeholder="Detailed Instructions for this agent..."
                                            />

                                            {/* Dependencies Selector */}
                                            <div className="mt-2 pt-2 border-t border-slate-800/50">
                                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 uppercase mb-1.5">
                                                    <Link2 className="w-3 h-3" />
                                                    <span>Depends On:</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tasks.filter(t => t.id !== task.id).map(other => {
                                                        const isDep = (task.dependencies || []).includes(other.id);
                                                        return (
                                                            <button
                                                                key={other.id}
                                                                onClick={() => {
                                                                    const currentDeps = task.dependencies || [];
                                                                    const newDeps = isDep 
                                                                        ? currentDeps.filter(d => d !== other.id)
                                                                        : [...currentDeps, other.id];
                                                                    onUpdateTask(task.id, { dependencies: newDeps });
                                                                }}
                                                                className={`
                                                                    px-2 py-1 rounded text-[10px] font-medium border transition-all
                                                                    ${isDep 
                                                                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' 
                                                                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                                                                    }
                                                                `}
                                                            >
                                                                {other.agentRole || 'Agent'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className={`text-xs font-medium ${task.status === 'running' ? 'text-slate-100' : 'text-slate-300'}`}>
                                                {task.title}
                                            </div>
                                            <div className="text-[10px] text-slate-500 leading-relaxed line-clamp-3" title={task.goal}>
                                                {task.goal}
                                            </div>
                                            
                                            {/* View-only Dependencies */}
                                            {task.dependencies && task.dependencies.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {task.dependencies.map(depId => {
                                                        const depTask = tasks.find(t => t.id === depId);
                                                        if (!depTask) return null;
                                                        return (
                                                            <span key={depId} className="text-[9px] px-1.5 py-0.5 bg-slate-800/50 rounded text-slate-500 border border-slate-800">
                                                                Wait for: {depTask.agentRole}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {/* Footer: Status Label / Priority Badge */}
                                    {!isReviewing && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-700/30 mt-auto">
                                            <span className={`text-[9px] font-mono uppercase tracking-wider ${task.status === 'running' ? 'text-brand-400 animate-pulse' : isBlocked ? 'text-amber-500/80' : 'opacity-50'}`}>
                                                {task.status === 'running' ? 'Executing...' : isBlocked ? 'Waiting for Dependency' : task.status}
                                            </span>
                                            
                                            {task.priority === 'high' && (
                                                <span className="flex items-center gap-1 text-[9px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                    HIGH
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Scanning Line Animation for Running State */}
                                {task.status === 'running' && (
                                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 left-0 right-0 h-full bg-gradient-to-b from-transparent via-brand-500/5 to-transparent animate-shimmer" style={{ backgroundSize: '100% 200%', animation: 'shimmer 2s linear infinite' }}></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                 {/* ADD AGENT BUTTON (Only in Review) */}
                 {isReviewing && onAddTask && (
                    <div className="flex flex-col items-center justify-start relative flex-1 min-w-[100px] max-w-[120px] pt-[24px]"> {/* pt accounts for connector line height */}
                        <div className="absolute -top-6 left-1/2 w-px h-6 bg-slate-800 -translate-x-1/2"></div>
                        <div className="absolute top-0 left-0 w-1/2 h-px bg-slate-800"></div>
                        
                        <button 
                            onClick={onAddTask}
                            className="
                                flex flex-col items-center justify-center gap-2 
                                w-full h-[160px] rounded-xl border-2 border-dashed border-slate-800 
                                text-slate-600 hover:text-brand-400 hover:border-brand-500/50 hover:bg-slate-900/50 
                                transition-all cursor-pointer group
                            "
                        >
                            <div className="p-2 rounded-full bg-slate-800/50 group-hover:bg-brand-500/10 transition-colors">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Add Agent</span>
                        </button>
                    </div>
                 )}
            </div>
        </div>
      )}
    </div>
  );
};
