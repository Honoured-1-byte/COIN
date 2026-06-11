import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Code, FileText, Lightbulb, ShieldAlert } from 'lucide-react';
import SmartText from './SmartText';

const ICONS = {
    1: FileText,   // Comprehensive
    2: Code,       // Technical
    3: Bot,        // Concise
    4: Lightbulb,  // Creative
    5: ShieldAlert // Critical
};

const COLORS = {
    1: "border-blue-500/50 text-blue-400 bg-blue-950/20",
    2: "border-emerald-500/50 text-emerald-400 bg-emerald-950/20",
    3: "border-amber-500/50 text-amber-400 bg-amber-950/20",
    4: "border-purple-500/50 text-purple-400 bg-purple-950/20",
    5: "border-red-500/50 text-red-400 bg-red-950/20"
};

// Helper to strip <think> tags
const cleanText = (text) => text?.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || "";

export default function HoloCard({ data, loading, onClick }) {
    const Icon = ICONS[data.id] || Bot;
    const theme = COLORS[data.id] || COLORS[1];
    const textContent = cleanText(data.content);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={`relative h-full p-4 rounded-xl border backdrop-blur-md overflow-hidden flex flex-col ${theme} ${onClick ? 'cursor-pointer hover:border-white/50 hover:shadow-lg transition-all' : ''}`}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2 bg-gradient-to-r from-transparent to-white/5 rounded-t-lg">
                <Icon className="w-5 h-5" />
                <span className="font-mono text-xs md:text-sm font-bold tracking-widest uppercase truncate">
                    {data.label}
                </span>
                {onClick && (
                    <span className="ml-auto text-[10px] text-cyan-400 opacity-70 hover:opacity-100 border border-cyan-500/30 px-1 rounded transition-all">
                        EXPAND
                    </span>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-gray-300 break-words">

                {/* Error Detection */}
                {textContent.includes("[ERROR:") ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-2 animate-pulse">
                        <ShieldAlert className="w-8 h-8 text-red-500 mb-2" />
                        <span className="font-mono text-xs text-red-400 font-bold uppercase tracking-widest">
                            SIGNAL LOSS
                        </span>
                        <div className="text-[10px] text-red-500/70 mt-1 font-mono break-all">
                            {/* Extract just the error code or message if possible, or show generic */}
                            {textContent.match(/ERROR: (.*?)(]|$)/)?.[1] || "Connection Failed"}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* If content is empty and still loading (waiting for first token) */}
                        {loading && !textContent ? (
                            <div className="animate-pulse flex flex-col gap-2 mt-4">
                                <div className="h-2 bg-white/10 rounded w-3/4"></div>
                                <div className="h-2 bg-white/10 rounded w-1/2"></div>
                            </div>
                        ) : (
                            <div className="h-full">
                                {/* Use SmartText for Math/Markdown */}
                                <SmartText content={textContent} />
                                {/* The Blinking Cursor */}
                                {loading && (
                                    <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse align-middle" />
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Decorative Corners */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/40"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/40"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/40"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/40"></div>
        </motion.div>
    );
}
