import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, ArrowLeft, Bot, User } from 'lucide-react';

export default function DebriefInterface({ selectedItem, onBack, groqKey }) {
    // selectedItem = { label: "Technical", content: "..." }
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const token = localStorage.getItem("council_token");
        if (!token) {
            alert("Session expired. Please re-login.");
            return;
        }

        const newMsg = { role: "user", content: input };
        setMessages(prev => [...prev, newMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    groq_key: groqKey,
                    context: selectedItem.content,
                    messages: messages, // Send history
                    user_prompt: input
                })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
        } catch (err) {
            alert("Connection Lost");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto h-[80vh] flex flex-col bg-slate-950/50 border border-cyan-500/30 rounded-xl overflow-hidden backdrop-blur-xl animate-fadeIn custom-scrollbar">

            {/* Header */}
            <div className="p-4 border-b border-cyan-500/30 flex justify-between items-center bg-cyan-950/30">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="hover:bg-white/10 p-2 rounded-full transition">
                        <ArrowLeft className="w-5 h-5 text-cyan-400" />
                    </button>
                    <div>
                        <h2 className="text-cyan-400 font-bold font-mono tracking-widest uppercase">
                            DEBRIEF MODE // {selectedItem.label}
                        </h2>
                        <p className="text-xs text-gray-400">Context Locked. Secure Line Active.</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* The Original Context (Collapsed or Initial) */}
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-8">
                    <p className="text-xs text-gray-500 font-mono mb-2 uppercase">/// SOURCE CONTEXT</p>
                    <div className="text-sm text-gray-300 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                        {/* Using a simple div to avoid ReactMarkdown layout issues in small clamps, or keep it if concise */}
                        <ReactMarkdown>{selectedItem.content}</ReactMarkdown>
                    </div>
                </div>

                {/* Messages */}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-emerald-600'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className={`p-4 rounded-xl max-w-[80%] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-cyan-950/50 text-cyan-50' : 'bg-slate-900 text-gray-300'} prose prose-invert`}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded bg-emerald-600/50 flex items-center justify-center shrink-0 animate-pulse">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="p-4 rounded-xl bg-slate-900/50 text-gray-400 text-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100" />
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200" />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-cyan-500/30 bg-black/40">
                <div className="flex gap-3">
                    <input
                        type="text"
                        className="flex-1 bg-slate-900 border border-slate-700/50 rounded-lg p-3 text-sm focus:border-cyan-500 outline-none text-white placeholder-gray-500"
                        placeholder="Ask a follow-up regarding this specific result..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white p-3 rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
