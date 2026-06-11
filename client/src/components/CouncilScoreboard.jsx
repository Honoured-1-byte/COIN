import React from 'react';
import { motion } from 'framer-motion';

export default function CouncilScoreboard({ scores }) {
    // scores format: { "1": 24, "2": 15 ... }
    if (!scores) return null;

    const maxScore = Math.max(...Object.values(scores));
    const sortedIds = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);

    const LABELS = {
        1: "Comprehensive", 2: "Technical", 3: "Concise", 4: "Creative", 5: "Critical"
    };

    return (
        <div className="w-full bg-black/40 border border-white/10 p-6 rounded-xl mb-8 overflow-hidden">
            <h3 className="text-cyan-400 font-mono text-sm mb-4 tracking-widest uppercase truncate">
        // COUNCIL VOTING RESULTS (BORDA COUNT)
            </h3>

            <div className="space-y-3">
                {sortedIds.map((id) => (
                    <div key={id} className="flex items-center gap-4">
                        <div className="w-24 md:w-32 text-xs font-mono text-gray-400 text-right shrink-0 truncate">
                            {LABELS[id]}
                        </div>
                        <div className="flex-1 min-w-0 h-6 bg-white/5 rounded-full overflow-hidden relative">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${maxScore > 0 ? (scores[id] / maxScore) * 100 : 0}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 absolute top-0 left-0"
                            />
                        </div>
                        <div className="w-8 text-xs font-bold text-cyan-300 shrink-0">
                            {scores[id]}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
