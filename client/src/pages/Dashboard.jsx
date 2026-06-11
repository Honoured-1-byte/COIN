import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, ChevronRight, FileText } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Dashboard() {
    const [history, setHistory] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("council_token");
        if (!token) {
            navigate("/");
            return;
        }

        fetch('/api/history', {
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch history");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setHistory(data);
                } else {
                    setHistory([]);
                }
            })
            .catch(err => console.error("Failed to load history", err));
    }, [navigate]);

    const handleOpenSession = (session) => {
        navigate('/council', { state: { sessionData: session } });
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-slate-950 text-white pt-24 px-6 pb-12">
                <div className="max-w-7xl mx-auto">

                    {/* Welcome Section */}
                    <div className="flex justify-between items-end mb-12 border-b border-white/10 pb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Welcome back, Architect.</h1>
                            <p className="text-gray-400 text-sm font-mono">SYSTEM STATUS: ONLINE // 5 AGENTS READY</p>
                        </div>
                        <Link to="/council">
                            <button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-cyan-900/20 transition-all transform hover:scale-105">
                                <Plus className="w-5 h-5" /> NEW SESSION
                            </button>
                        </Link>
                    </div>

                    {/* History Grid */}
                    <h2 className="text-xl font-mono text-cyan-400 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5" /> RECENT ARCHIVES
                    </h2>

                    {history.length === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-gray-500">No archives found. Start your first session.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {history.map((session) => (
                                <div
                                    key={session._id || session.id}
                                    onClick={() => handleOpenSession(session)}
                                    className="bg-black/20 border border-white/10 p-5 rounded-xl hover:border-cyan-500/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-cyan-950/30 p-2 rounded-lg">
                                            <FileText className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <span className="text-xs font-mono text-gray-500">
                                            {new Date(session.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-2 line-clamp-2 leading-tight group-hover:text-cyan-300 transition-colors">
                                        {session.prompt}
                                    </h3>
                                    <p className="text-sm text-gray-400 line-clamp-3 mb-4">
                                        {session.verdict?.replace(/[#*]/g, '').substring(0, 100)}...
                                    </p>
                                    <div className="flex items-center text-xs font-bold text-cyan-500 gap-1">
                                        VIEW REPORT <ChevronRight className="w-3 h-3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
