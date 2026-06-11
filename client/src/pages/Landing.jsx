import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Cpu, ChevronRight, AlertCircle } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '', apiKey: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isRegistering ? '/api/register' : '/api/login';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, password: formData.password }), // Only send auth data to auth endpoint
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Access Denied');

            // SUCCESS: 1. Store Token
            localStorage.setItem('council_token', data.token);
            localStorage.setItem('council_user', data.user.email);

            // 2. Set API Key (if provided)
            if (formData.apiKey) {
                const keyRes = await fetch('/api/settings/key', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${data.token}`
                    },
                    body: JSON.stringify({ apiKey: formData.apiKey.trim() }),
                    credentials: 'include'
                });
                if (!keyRes.ok) {
                    console.warn("Failed to save API Key during login");
                    // We don't block login, but we should probably alert the user or they will see the Red Lock
                }
            }

            // Navigate to Dashboard
            navigate('/dashboard');

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-mono text-cyan-500 relative overflow-hidden">
            {/* Background FX */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="max-w-md w-full bg-slate-900/80 border border-cyan-500/30 p-8 rounded-lg backdrop-blur-xl shadow-[0_0_50px_rgba(6,182,212,0.1)] relative z-10">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        <Cpu className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] text-cyan-100">C.O.I.N.</h1>
                    <p className="text-xs text-cyan-600 mt-2 tracking-widest">COUNCIL OF INTELLIGENCE NETWORK</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-1 text-slate-500">Identity</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                            <input
                                type="email"
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-9 text-cyan-100 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                                placeholder="OPERATIVE ID (EMAIL)"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-1 text-slate-500">Passcode</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                            <input
                                type="password"
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-9 text-cyan-100 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                                placeholder="ACCESS CODE"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest mb-1 text-slate-500">Groq API Key</label>
                        <div className="relative">
                            <Cpu className="absolute left-3 top-2.5 w-4 h-4 text-slate-600" />
                            <input
                                type="password"
                                required={isRegistering} /* Mandatory for new users */
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-9 text-cyan-100 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                                placeholder="gsk_..."
                                value={formData.apiKey}
                                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/50 py-2 rounded transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                    >
                        {loading ? "AUTHENTICATING..." : (isRegistering ? "INITIALIZE CLEARANCE" : "ACCESS TERMINAL")}
                        {!loading && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                        {isRegistering ? "ALREADY HAVE CLEARANCE? LOGIN" : "REQUEST NEW IDENTITY"}
                    </button>
                </div>
            </div>
        </div>
    );
}
