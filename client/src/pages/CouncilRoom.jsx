import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { X, Trophy, BarChart3, FileText, ChevronRight, MessageSquare, Microscope, Paperclip, Send, Cpu, Users, Menu, LayoutGrid, ChevronLeft, ChevronRight as ChevronRightIcon, PanelLeft, PanelRight, Settings, Lock } from 'lucide-react';
import Background from '../components/Background';
import ControlPanel from '../components/ControlPanel';
import FibonacciAnimation from '../components/FibonacciAnimation';
import HoloCard from '../components/HoloCard';
import CouncilScoreboard from '../components/CouncilScoreboard';
import VerdictDisplay from '../components/VerdictDisplay';
import DebriefInterface from '../components/DebriefInterface';
import HistorySidebar from '../components/HistorySidebar';
import SmartText from '../components/SmartText';

// -- Force Refresh --
export default function CouncilRoom() {
    const location = useLocation();
    const [status, setStatus] = useState("idle");
    const [results, setResults] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [activeSessionId, setActiveSessionId] = useState(null);

    // --- STATE MANAGER ---
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Left "Archive" Sidebar on Mobile
    const [historySidebarOpen, setHistorySidebarOpen] = useState(window.innerWidth > 1024);
    const [isR2SidebarOpen, setR2SidebarOpen] = useState(window.innerWidth > 1024); // Round 2 "Active Section" Sidebar

    // --- LIFTED STATE (Security) ---
    const [hasKey, setHasKey] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Check Key Status on Mount (Lifted from ControlPanel)
    useEffect(() => {
        const checkKey = async () => {
            // Priority Check: Secure Cookie Only
            // LocalStorage check removed for security

            try {
                const token = localStorage.getItem("council_token");
                const res = await fetch("/api/settings/status", {
                    headers: { "Authorization": `Bearer ${token}` },
                    credentials: 'include'
                });
                const data = await res.json();

                // Only update if true or if we are initializing (not overwriting a manual 'true' with a lagged 'false' unless persistent)
                // Actually, server source of truth is best.
                setHasKey(data.hasKey);
            } catch (e) { console.error("Key Check Failed", e); }
        };
        // Initial check
        checkKey();

        // Polling or Re-check when settings close (optional)
        if (!showSettings) checkKey();

    }, [showSettings, location.key]);

    // Authenticate on load
    useEffect(() => {
        const token = localStorage.getItem('council_token');
        if (!token) window.location.href = '/';
    }, []);

    // Round 2 Tab State
    const [activeTab, setActiveTab] = useState('verdict');
    const [selectedContext, setSelectedContext] = useState(null);

    // Load from History
    useEffect(() => {
        if (location.state?.sessionData) {
            const data = location.state.sessionData;
            setSessionData(data);
            setActiveSessionId(data._id);
            if (data.reports) {
                const reportMap = data.reports.reduce((acc, curr) => {
                    acc[curr.id] = curr.content;
                    return acc;
                }, {});
                setResults(reportMap);
            }
        }
    }, [location.state]);

    // Defaults when session loads
    useEffect(() => {
        if (sessionData) {
            setActiveTab('verdict');
            setR2SidebarOpen(window.innerWidth > 1024); // Reset Sidebar state based on screen
        }
    }, [sessionData]);

    const handleDebrief = (label, content) => {
        setSelectedContext({ label, content });
    };

    const handleLoadSession = (session) => {
        setActiveSessionId(session._id);
        if (session.reports) {
            const reportMap = session.reports.reduce((acc, curr) => {
                acc[curr.id] = curr.content;
                return acc;
            }, {});
            setResults(reportMap);
        }
        if (session.round >= 2) {
            setSessionData(session);
            setStatus("idle");
        } else {
            setSessionData(null);
            setStatus("idle");
        }
        setMobileMenuOpen(false);
    };

    const resetBoard = () => {
        // 1. Wipe the visual evidence immediately
        setResults({});        // Clears the 5 Agent Cards
        setSessionData(null);  // Clears the Chairman's text and Round 2 data
        setActiveSessionId(null); // Detaches from the old ID
        setStatus("idle");

        // 2. Trigger History Sidebar Refresh (by closing/reopening or we'll pass a refresher down later)
        // For now, removing active ID is enough to de-select sidebar item

        // 3. Optional: Close Mobile Menu if open
        setMobileMenuOpen(false);
    };

    const cleanText = (text) => text?.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || "";
    function getLabel(id) {
        const map = { 1: "Comprehensive", 2: "Technical", 3: "Concise", 4: "Creative", 5: "Critical" };
        return map[id] || "Agent";
    }

    // --- VIEW 1: DEBRIEF INTERFACE ---
    if (selectedContext) {
        return (
            <div className="h-screen w-full bg-[#050505] overflow-hidden font-orbitron relative flex flex-col pt-20 px-4">
                <Background />
                <DebriefInterface
                    selectedItem={selectedContext}
                    onBack={() => setSelectedContext(null)}
                />
            </div>
        );
    }

    // Round 2 View Renderer
    const renderActiveView = () => {
        if (activeTab === 'verdict' && sessionData) {
            return (
                <div className="flex flex-col gap-6 w-full"> {/* Added w-full */}
                    <VerdictDisplay content={sessionData.verdict} />
                </div>
            );
        }
        if (activeTab === 'graph' && sessionData) {
            return (
                <div className="bg-black/40 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
                    <h3 className="text-cyan-400 font-mono text-sm mb-6 uppercase tracking-widest border-b border-white/5 pb-2">
                        // VOTING METRICS
                    </h3>
                    <CouncilScoreboard scores={sessionData.math_result?.full_scores} />
                </div>
            );
        }
        const id = parseInt(activeTab);
        if (results && results[id]) {
            return (
                <div className="h-full animate-fadeIn flex flex-col gap-6">
                    <HoloCard
                        data={{ id, label: getLabel(id), content: results[id] }}
                        loading={false}
                    />
                </div>
            );
        }
        return null;
    };

    const isRound2 = !!sessionData;

    return (
        <div className="h-screen bg-[#050505] text-gray-100 font-orbitron selection:bg-cyan-500/30 flex overflow-hidden relative">

            {/* MOBILE OVERLAY (For History Sidebar) */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-[60] md:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* LEFT: HISTORY SIDEBAR (Responsive) */}
            <div className={`
                fixed md:static inset-y-0 left-0 z-[70] transform transition-all duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
                ${historySidebarOpen ? 'md:w-64' : 'md:w-0 md:opacity-0 md:pointer-events-none'}
                bg-slate-900 border-r border-slate-800
                shrink-0 h-full overflow-hidden
            `}>
                <HistorySidebar
                    onSelectSession={handleLoadSession}
                    activeSessionId={activeSessionId}
                    onClose={() => {
                        setHistorySidebarOpen(false);
                        setMobileMenuOpen(false);
                    }}
                />
            </div>

            {/* RIGHT: MAIN CONTENT */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
                <Background />
                {/* 
                    GLOBAL ANIMATION LAYER
                    - Visible in both Idle (Round 1) and Retracted (Round 2) states.
                    - Fixed position (handled by component).
                    - Vertically oriented on Mobile (handled by component).
                */}
                <FibonacciAnimation />

                {/* HEADER */}
                <header className="p-3 md:p-4 border-b border-cyan-900/30 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile Toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="md:hidden p-2 text-cyan-400 border border-cyan-900 rounded hover:bg-cyan-900/20 mr-2"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Desktop Toggle (Only visible when sidebar is closed) */}
                        {!historySidebarOpen && (
                            <button
                                onClick={() => setHistorySidebarOpen(true)}
                                className="hidden md:flex p-2 text-cyan-400/70 hover:text-cyan-400 rounded hover:bg-cyan-900/20 mr-2 transition-colors"
                            >
                                <PanelLeft className="w-5 h-5" />
                            </button>
                        )}

                        <Link to="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500/10 rounded border border-cyan-500/50 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                                <Cpu className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                            </div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-widest text-cyan-100">
                                C.O.I.N.
                            </h1>
                        </Link>
                    </div>

                    {/* Security Toggle (Always Visible) */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className={`p-2 rounded-lg border transition-all ${hasKey
                            ? 'bg-slate-800/90 border-slate-700 text-gray-400 hover:text-cyan-400'
                            : 'bg-red-900/20 border-red-500 text-red-500 animate-pulse'
                            }`}
                    >
                        {hasKey ? <Lock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </button>
                    {/* End Header */}
                </header>

                <div className="flex-1 flex flex-col relative w-full overflow-hidden">
                    {isRound2 ? (
                        // ==========================
                        // ROUND 2: RETRACTABLE WORKSTATION
                        // ==========================
                        <div className="flex w-full h-full relative overflow-hidden">
                            {/* MOBILE SIDEBAR BACKDROP */}
                            {isR2SidebarOpen && (
                                <div
                                    className="fixed inset-0 bg-black/60 z-[19] lg:hidden backdrop-blur-sm"
                                    onClick={() => setR2SidebarOpen(false)}
                                />
                            )}

                            {/* 1. SIDEBAR (Navigation) */}
                            <div className={`
                                    border-r border-cyan-900/30 bg-slate-900/40 backdrop-blur-md flex flex-col
                                    transform transition-all duration-300 ease-in-out shrink-0 overflow-hidden
                                    fixed lg:static inset-y-0 left-0 z-20 h-full
                                    ${isR2SidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:pointer-events-none'}
                                `}>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Analysis Modules</span>
                                    <button onClick={() => setR2SidebarOpen(false)} className="text-gray-500 hover:text-cyan-400">
                                        <PanelRight className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
                                    {/* Side Menu Items */}
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => { setActiveTab('verdict'); if (window.innerWidth < 1024) setR2SidebarOpen(false); }}
                                            className={`flex items-center gap-3 p-3 rounded-lg text-sm font-bold transition-all ${activeTab === 'verdict' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'text-gray-400 hover:bg-white/5'}`}>
                                            <Trophy className="w-4 h-4" />
                                            VERDICT
                                        </button>
                                        <button onClick={() => { setActiveTab('graph'); if (window.innerWidth < 1024) setR2SidebarOpen(false); }}
                                            className={`flex items-center gap-3 p-3 rounded-lg text-xs font-mono transition-all ml-4 ${activeTab === 'graph' ? 'text-cyan-300' : 'text-gray-500 hover:text-white'}`}>
                                            <BarChart3 className="w-3 h-3" />
                                            METRICS
                                        </button>
                                        <button onClick={() => { handleDebrief("Chairman Verdict", sessionData.verdict); if (window.innerWidth < 1024) setR2SidebarOpen(false); }}
                                            className={`flex items-center gap-3 p-3 rounded-lg text-xs font-mono transition-all ml-4 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/10`}>
                                            <MessageSquare className="w-3 h-3" />
                                            INTERROGATE
                                        </button>
                                    </div>

                                    <div className="h-px bg-white/5 my-2" />
                                    <h4 className="text-[10px] font-mono text-gray-600 uppercase tracking-widest pl-2 mb-2">Evidence</h4>
                                    {[1, 2, 3, 4, 5].map(id => (
                                        <div key={id} className={`flex items-center mx-2 rounded-lg transition-all group ${activeTab === id.toString() ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                            <button onClick={() => { setActiveTab(id.toString()); if (window.innerWidth < 1024) setR2SidebarOpen(false); }}
                                                className={`flex-1 flex items-center gap-3 p-3 text-xs font-mono text-left ${activeTab === id.toString() ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === id.toString() ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-gray-700 group-hover:bg-gray-500'}`}></span>
                                                {getLabel(id)}
                                            </button>

                                            {/* Inline Debrief Button */}
                                            {results && results[id] && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDebrief(`${getLabel(id)} Agent`, results[id]);
                                                        if (window.innerWidth < 1024) setR2SidebarOpen(false);
                                                    }}
                                                    className={`p-2 mr-1 rounded hover:bg-emerald-900/40 text-gray-600 hover:text-emerald-400 transition-all ${activeTab === id.toString() ? 'text-emerald-400/50' : 'opacity-0 group-hover:opacity-100'}`}
                                                    title="Debrief Agent"
                                                >
                                                    <MessageSquare className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 2. THE MAIN CONTENT AREA */}
                            <div className="flex-1 h-full overflow-y-auto custom-scrollbar relative bg-black/20 w-full">

                                {/* TOGGLE BUTTON (Variable Visibility) */}
                                {!isR2SidebarOpen && (
                                    <button
                                        onClick={() => setR2SidebarOpen(true)}
                                        className="absolute top-4 left-4 z-10 p-2 bg-slate-900/80 border border-cyan-500/30 text-cyan-400 rounded-md hover:bg-cyan-900/40 transition-colors shadow-lg backdrop-blur"
                                    >
                                        <PanelRight className="w-4 h-4" />
                                    </button>
                                )}

                                <div className={`p-4 lg:p-12 w-full mx-auto pt-16 lg:pt-12 transition-all duration-300 ${isR2SidebarOpen ? 'max-w-5xl' : 'max-w-7xl'}`}>
                                    {renderActiveView()}
                                    {/* Spacer to prevent input bar overlap */}
                                    <div className="h-32 w-full shrink-0" aria-hidden="true" />
                                </div>
                            </div>

                        </div>
                    ) : (
                        // ==========================
                        // IDLE / ROUND 1 (FIXED LAYOUT)
                        // ==========================
                        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col h-full overflow-hidden">

                            <div className="shrink-0 pt-8 pb-4 hidden md:flex justify-center">
                                <h1 className="text-lg md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-[0.2em] text-center uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                                    COUNCIL OF INTELLIGENCE NETWORKS
                                </h1>
                            </div>

                            {/* CENTERED CONTENT (Cards) */}
                            <div className="flex-1 flex flex-col justify-start md:justify-center min-h-0 pb-40 overflow-y-auto custom-scrollbar"> {/* Reduced Bottom Padding */}
                                {!results && status !== "thinking" ? (
                                    // Empty state: Global FibonacciAnimation provides visuals
                                    null
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full px-4 items-center">
                                        {[1, 2, 3, 4, 5].map(id => (
                                            results && results[id] !== undefined ? (
                                                <div key={id} className="h-[360px] w-full flex flex-col"> {/* Height Reduced Further */}
                                                    <HoloCard
                                                        data={{ id: id, label: getLabel(id), content: results[id] }}
                                                        loading={status === "thinking"}
                                                        onClick={() => setSelectedCard({ id, label: getLabel(id), content: results[id] })}
                                                    />
                                                </div>
                                            ) : null
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ControlPanel (Fixed Bottom) */}
                    <div className={`absolute bottom-0 w-full z-40 pointer-events-none transition-all duration-300 ease-in-out ${isRound2 && isR2SidebarOpen ? 'lg:pl-64' : ''}`}>
                        <div className="pointer-events-auto">
                            <ControlPanel
                                onStatusChange={setStatus}
                                setResults={setResults}
                                setSessionData={setSessionData}
                                onReset={resetBoard}
                                // Passed Props
                                hasKey={hasKey}
                                setHasKey={setHasKey}
                                showSettings={showSettings}
                                setShowSettings={setShowSettings}
                            />
                        </div>
                    </div>
                </div>
            </div >

            {/* MODAL */}
            {
                selectedCard && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn" onClick={() => setSelectedCard(null)}>
                        <div className="bg-black/80 border border-cyan-500/30 w-full max-w-5xl max-h-[85vh] rounded-2xl p-8 overflow-y-auto custom-scrollbar relative shadow-[0_0_50px_rgba(6,182,212,0.2)]" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setSelectedCard(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                                <X className="w-8 h-8" />
                            </button>
                            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                                <span className="text-cyan-400 font-mono text-xl font-bold tracking-widest uppercase">// {selectedCard.label} REPORT</span>
                            </div>
                            <div className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed text-gray-300">
                                <SmartText content={cleanText(selectedCard.content)} />
                            </div>
                            <div className="mt-8 pt-4 border-t border-white/10 flex justify-center">
                                <button onClick={(e) => { e.stopPropagation(); handleDebrief(`${selectedCard.label} Model`, selectedCard.content); setSelectedCard(null); }} className="bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500 text-emerald-400 px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                                    <Microscope className="w-4 h-4" />
                                    DEBRIEF / INTERROGATE
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
