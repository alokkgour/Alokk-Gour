import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { Source } from '../types';

interface SourceCardProps {
  source: Source;
  index: number;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, index }) => {
  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (e) {
      return '';
    }
  };

  const getDisplayUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (e) {
      return url;
    }
  };

  return (
    <a 
      href={source.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="
        group relative flex flex-col flex-shrink-0 w-72 
        bg-slate-900/40 hover:bg-slate-800/60 
        border border-slate-800 hover:border-slate-700 
        rounded-xl p-4 transition-all duration-300 ease-out
        cursor-pointer no-underline overflow-hidden
      "
    >
      {/* Hover Highlight Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header: Icon & Source Name */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5 max-w-[85%]">
          <div className="relative w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:border-slate-600 transition-colors overflow-hidden">
            <Globe className="w-3.5 h-3.5 text-slate-600 absolute" />
            <img 
              src={getFaviconUrl(source.url)} 
              alt="" 
              className="w-4 h-4 object-contain opacity-90 group-hover:opacity-100 transition-opacity relative z-10"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-300 truncate group-hover:text-brand-200 transition-colors">
              {source.source || getDisplayUrl(source.url)}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded text-center min-w-[20px] border border-slate-800">
          {index + 1}
        </span>
      </div>
      
      {/* Content: Title & Snippet */}
      <div className="flex-1 flex flex-col gap-2 relative z-10">
        <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {source.title}
        </h3>
        
        {source.snippet && (
          <p className="text-xs text-slate-400/80 line-clamp-3 leading-relaxed font-light">
            {source.snippet}
          </p>
        )}
      </div>

      {/* Footer: URL & Icon */}
      <div className="mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-500 font-medium border-t border-slate-800/50 group-hover:border-slate-700/50 transition-colors relative z-10">
        <span className="truncate max-w-[180px] opacity-60 group-hover:opacity-100 transition-opacity">
          {source.url}
        </span>
        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-brand-400 transition-colors" />
      </div>
    </a>
  );
};