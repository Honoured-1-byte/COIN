import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cpu, LayoutGrid, LogOut } from 'lucide-react';

export default function Navbar() {
    const location = useLocation();
    if (location.pathname === "/") return null; // Don't show on landing page

    return (
        <nav className="fixed top-0 left-0 w-full h-16 bg-slate-950/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-50">
            <Link to="/dashboard" className="flex items-center gap-2 group">
                <div className="bg-cyan-500/20 p-2 rounded-lg group-hover:bg-cyan-500/40 transition">
                    <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <span className="font-mono font-bold text-xl tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    C.O.I.N.
                </span>
            </Link>

            <div className="flex gap-4">
                <Link to="/dashboard" className="flex items-center gap-2 text-sm font-mono text-gray-400 hover:text-cyan-400 transition">
                    <LayoutGrid className="w-4 h-4" /> DASHBOARD
                </Link>
                <Link to="/" className="flex items-center gap-2 text-sm font-mono text-gray-400 hover:text-red-400 transition">
                    <LogOut className="w-4 h-4" /> LOGOUT
                </Link>
            </div>
        </nav>
    );
}
