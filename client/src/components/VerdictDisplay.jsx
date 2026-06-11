import React, { useState } from 'react';
import SmartText from './SmartText';
import { Crown, Brain, ChevronDown, ChevronUp } from 'lucide-react';

export default function VerdictDisplay({ content }) {
    const [showThink, setShowThink] = useState(false);

    if (!content) {
        return (
            <div className="w-full max-w-4xl mx-auto mt-8 border-2 border-red-500/50 bg-red-950/10 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-pulse">
                <div className="p-6 text-center text-red-400 font-mono font-bold tracking-widest">
                    ⚠️ VERDICT UNAVAILABLE // COUNCIL ERROR
                </div>
            </div>
        );
    }

    // Extract content inside <think> tags
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    const thinkContent = thinkMatch ? thinkMatch[1].trim() : null;

    // Remove <think> tags and their content from the main display
    const visibleContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    return (
        <div className="w-full max-w-none mx-auto mt-8 border-2 border-cyan-500/50 bg-cyan-950/10 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <div className="bg-cyan-950/50 p-3 border-b border-cyan-500/30 flex flex-wrap items-center gap-4 relative">
                <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    <span className="text-cyan-400 font-mono font-bold tracking-widest">
                        FINAL VERDICT
                    </span>
                </div>

                {thinkContent && (
                    <button
                        onClick={() => setShowThink(!showThink)}
                        className={`
                            flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-300
                            ${showThink
                                ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-transparent'
                                : 'bg-gradient-to-r from-amber-900/20 to-red-900/20 text-amber-500 border border-amber-500/40 hover:border-amber-400 hover:text-amber-300 hover:bg-amber-900/30'
                            }
                        `}
                    >
                        <Brain className="w-4 h-4" />
                        CHAIRMAN SYNTHESIS
                        {showThink ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Hidden Thought Section */}
            {showThink && thinkContent && (
                <div className="bg-black/40 border-b border-amber-500/20 p-6 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-4 text-amber-500/80 font-mono text-xs uppercase tracking-widest">
                        <Brain className="w-4 h-4" />
                        <span>Internal Processing Logic</span>
                    </div>
                    <div className="prose prose-invert prose-amber max-w-none text-sm font-mono opacity-90 pl-4 border-l-2 border-amber-500/30">
                        <SmartText content={thinkContent} />
                    </div>
                </div>
            )}

            <div className="p-4 md:p-8">
                <SmartText content={visibleContent} className="prose-cyan" />
            </div>
        </div>
    );
}
