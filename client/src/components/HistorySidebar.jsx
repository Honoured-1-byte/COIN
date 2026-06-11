import React, { useEffect, useState } from 'react';
import { Clock, Database, ChevronRight, Archive, PanelLeft, X } from 'lucide-react';

export default function HistorySidebar({ onSelectSession, activeSessionId, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch History on Mount
    useEffect(() => {
        const token = localStorage.getItem("council_token");
        fetch('/api/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to load history");
                return res.json();
            })
            .then(data => {
                setHistory(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("History fetch error:", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="w-64 h-full bg-slate-900 border-r border-slate-800 flex-col font-mono text-sm flex shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 text-cyan-400 mb-1">
                        <Archive className="w-4 h-4" />
                        <span className="font-bold tracking-wider">ARCHIVES</span>
                    </div>
                    <div className="text-xs text-slate-500">MISSION LOGS</div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-cyan-400 p-1 hover:bg-cyan-900/20 rounded transition-colors"
                        title="Close Sidebar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {loading ? (
                    <div className="text-center p-4 text-slate-600 animate-pulse">
                        DECRYPTING...
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center p-4 text-slate-600">NO DATA</div>
                ) : (
                    history.map((session) => (
                        <button
                            key={session._id}
                            onClick={() => onSelectSession(session)}
                            className={`w-full text-left p-3 rounded border transition-all group relative overflow-hidden ${activeSessionId === session._id
                                ? 'bg-cyan-900/20 border-cyan-500 text-cyan-100'
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:bg-slate-800'
                                }`}
                        >
                            {/* Hover Glow Effect */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${activeSessionId === session._id ? 'bg-cyan-500' : 'bg-transparent group-hover:bg-cyan-500/50'
                                }`} />

                            <div className="font-medium truncate mb-1 pr-2">
                                {session.prompt}
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase">
                                <span className={`px-1.5 py-0.5 rounded ${session.category === 'MATH' ? 'bg-purple-900/50 text-purple-400' :
                                    session.category === 'CREATIVE' ? 'bg-pink-900/50 text-pink-400' :
                                        'bg-blue-900/50 text-blue-400'
                                    }`}>
                                    {session.category || 'GEN'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Footer Stat */}
            <div className="p-3 border-t border-slate-800 text-[10px] text-slate-600 text-center flex items-center justify-center gap-2">
                <Database className="w-3 h-3" />
                <span>{history.length} RECORDS STORED</span>
            </div>
        </div>
    );
}
