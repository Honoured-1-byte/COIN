import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, Cpu, Settings, Lock } from 'lucide-react';

// Pass `onStatusChange` and `setSessionData` from the parent (App.jsx)
export default function ControlPanel({
    onStatusChange, setResults, setSessionData, onReset,
    hasKey, setHasKey, showSettings, setShowSettings
}) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [stage, setStage] = useState('idle'); // 'idle', 'round1', 'complete'
    const [reportsCache, setReportsCache] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null); // Stores base64 string
    const textareaRef = useRef(null);

    const [minimized, setMinimized] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState("");

    // (Key Check Effect removed - Lifted to CouncilRoom.jsx)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input, minimized]);

    // Handle Image Upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedImage(reader.result); // This sets the Base64 string
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const token = localStorage.getItem("council_token");
        // Removed localKey check for security - using Cookie only

        if (!token) {
            alert("No session token found. Please login.");
            return;
        }

        // --- STAGE 1: SUBMIT PROMPT (GENERATION) ---
        if (stage === 'idle' || stage === 'complete') {
            if (!input.trim() && !selectedImage) return;

            setLoading(true);
            onStatusChange("thinking");

            // Initialize Empty Cards
            const initialMap = { 1: "", 2: "", 3: "", 4: "", 5: "" };
            if (setResults) setResults(initialMap);
            setReportsCache([]); // Will rebuild this

            try {
                const response = await fetch("/api/stream-round-1", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    credentials: 'include', // <--- IMPORTANT: Send Cookies
                    body: JSON.stringify({
                        user_prompt: input || "Analyze this image", // Fallback if only image
                        image_data: selectedImage,
                        groq_key: null // <--- KEY IS NOW IN COOKIE ONLY
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    if (response.status === 400 && errorText.includes("Missing API Key")) {
                        setShowSettings(true); // Open settings
                        onStatusChange("idle"); // Reset status
                        setLoading(false);      // Stop loading spinner
                        return;                 // Stop execution (No Alert)
                    }
                    throw new Error(`Stream failed: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullContentMap = { ...initialMap };

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const jsonStr = line.replace("data: ", "").trim();
                            if (jsonStr === "[DONE]") {
                                onStatusChange("idle"); // Streaming done
                                setStage('round1');

                                // Reconstruct reports array for next stage
                                const reportsArray = Object.keys(fullContentMap).map(id => ({
                                    id: parseInt(id),
                                    content: fullContentMap[id],
                                    label: ["Comprehensive", "Technical", "Concise", "Creative", "Critical"][id - 1] // Hardcoded label mapping for safety
                                }));
                                setReportsCache(reportsArray);
                                return;
                            }

                            try {
                                const parsed = JSON.parse(jsonStr);
                                if (parsed.error) continue;

                                const { id, chunk } = parsed;
                                if (chunk) {
                                    fullContentMap[id] += chunk;
                                    if (setResults) setResults({ ...fullContentMap });
                                }

                            } catch (e) {
                                console.warn("Parse error", e);
                            }
                        }
                    }
                }

            } catch (error) {
                console.error("Stream Failed:", error);
                alert("Stream Generation Failed: " + error.message);
                onStatusChange("error");
                setStage('idle'); // Reset to idle so user can retry
            } finally {
                setLoading(false);
            }
        }

        // --- STAGE 2: CONVENE COUNCIL (VOTING & VERDICT) ---
        else if (stage === 'round1') {
            setLoading(true);
            onStatusChange("thinking"); // Or a new state like "debating"

            try {
                const response = await fetch("/api/round-2", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    credentials: 'include', // <--- IMPORTANT: Send Cookies
                    body: JSON.stringify({
                        user_prompt: input,
                        reports: reportsCache,
                        groq_key: null // <--- KEY IS NOW IN COOKIE ONLY
                    })
                });

                const data = await response.json();
                console.log("Round 2 Results:", data);

                // Update UI with Final Verdict included
                const finalMap = (data.reports || []).reduce((acc, curr) => {
                    acc[curr.id] = curr.content;
                    return acc;
                }, {});

                // Pass full session (including math_result and verdict) to App
                if (setSessionData) setSessionData(data);
                if (setResults) setResults(finalMap);

                setStage('complete');
                setMinimized(true); // <--- AUTO RETRACT
                setInput(""); // Reset input only after full session
                setSelectedImage(null);

                // Allow timeout for state update before shrinking
                setTimeout(() => {
                    if (textareaRef.current) textareaRef.current.style.height = 'auto';
                }, 100);

                onStatusChange("idle");

            } catch (error) {
                console.error("Round 2 Failed:", error);
                onStatusChange("error");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!loading && (stage !== 'round1' || input)) { // Allow submit if not loading
                handleSubmit(e);
            }
        }
    };

    const saveKey = async () => {
        try {
            const token = localStorage.getItem("council_token");
            const res = await fetch("/api/settings/key", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
                credentials: 'include'
            });
            const data = await res.json();

            if (res.ok) {
                // REMOVED: localStorage.setItem("groq_key_local", apiKeyInput);
                setHasKey(true);
                setShowSettings(false);
                setApiKeyInput("");
                alert("Security Clearance Updated. Key Encrypted & Stored.");
            } else {
                alert(data.error || "Invalid Key Format");
            }
        } catch (e) { alert("Save Failed: " + e.message); }
    };


    // --- RETRACTED VIEW ---
    if (minimized) {
        return (
            <div className="w-full flex justify-center pb-10 z-50 pointer-events-auto animate-fadeIn gap-4">
                {/* SETTINGS BUTTON REMOVED (Duplicate) */}

                <button
                    onClick={() => {
                        setMinimized(false);
                        setStage('idle');
                        if (onReset) onReset(); // <--- Trigger the Hard Reset
                    }}
                    className="bg-cyan-600/80 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold backdrop-blur-md border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center gap-2 transition-all hover:scale-105"
                >
                    <Cpu className="w-5 h-5" />
                    <span className="hidden md:inline">NEW INQUIRY</span>
                </button>

                {/* API KEY MODAL */}
                {showSettings && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                        <div className="bg-slate-900 border border-cyan-500/50 p-8 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                            <h2 className="text-xl text-cyan-400 font-bold mb-4 flex items-center gap-2">
                                <Lock className="w-5 h-5" /> SECURITY CREDENTIALS
                            </h2>
                            <p className="text-sm text-gray-400 mb-6 font-mono">
                                Enter your Groq API Key. It will be encrypted (AES-256) and stored in a secure local cookie. The server will never log it.
                            </p>
                            <input
                                type="password"
                                placeholder={hasKey ? "•••••••• (Key Secured)" : "gsk_..."}
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                className="w-full bg-black/50 border border-gray-700 rounded p-3 text-white font-mono mb-4 focus:border-cyan-500 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-gray-400 hover:text-white">CANCEL</button>
                                <button onClick={saveKey} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold">ENCRYPT & SAVE</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full flex justify-center pb-10 z-50 perspective-[1000px] pointer-events-none px-4">
            {/* API KEY MODAL (Copy for Max View) */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] pointer-events-auto">
                    <div className="bg-slate-900 border border-cyan-500/50 p-8 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                        <h2 className="text-xl text-cyan-400 font-bold mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5" /> SECURITY CREDENTIALS
                        </h2>
                        <p className="text-sm text-gray-400 mb-6 font-mono">
                            Enter your Groq API Key. It will be encrypted (AES-256) and stored in a secure local cookie. The server will never log it.
                        </p>
                        <input
                            type="password"
                            placeholder={hasKey ? "•••••••• (Key Secured)" : "gsk_..."}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded p-3 text-white font-mono mb-4 focus:border-cyan-500 outline-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-gray-400 hover:text-white">CANCEL</button>
                            <button onClick={saveKey} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold">ENCRYPT & SAVE</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-5xl flex flex-col items-center pointer-events-auto">

                {/* IMAGE PREVIEW (Shows if image is selected) */}
                {selectedImage && (
                    <div className="relative w-full max-w-2xl mb-2 p-2 bg-slate-900/80 border border-cyan-500/30 rounded-lg flex items-center shadow-lg animate-fadeIn gap-4">
                        <img src={selectedImage} alt="Upload" className="h-16 w-16 object-cover rounded border border-white/20" />
                        <div className="text-xs text-cyan-400 font-mono">
                            IMAGE ATTACHED // VISION MODULES ACTIVE
                        </div>
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full text-red-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="w-full max-w-5xl flex gap-2 items-end">
                    {/* SETTINGS BUTTON REMOVED (Moved to Navbar) */}

                    <form onSubmit={handleSubmit} className="flex-1 flex gap-4 p-4 bg-slate-800/90 backdrop-blur-xl border border-cyan-500/50 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] transition-all duration-300 focus-within:border-cyan-400 focus-within:shadow-[0_0_40px_rgba(6,182,212,0.3)] items-end">

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            accept="image/*"
                            id="img-upload"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={loading || stage === 'round1' || !hasKey}
                        />

                        {/* Upload Button */}
                        <label
                            htmlFor="img-upload"
                            onClick={() => !hasKey && setShowSettings(true)}
                            className={`shrink-0 bg-slate-800 border border-slate-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-400 w-12 h-12 rounded-lg cursor-pointer transition-all flex items-center justify-center ${selectedImage ? 'border-cyan-500 text-cyan-400' : ''} ${loading || stage === 'round1' || !hasKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Paperclip className="w-5 h-5" />
                        </label>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading || stage === 'round1' || !hasKey}
                            onClick={() => !hasKey && setShowSettings(true)}
                            rows={1}
                            placeholder={
                                !hasKey ? "⚠️ SYSTEM LOCKED // ENTER KEY >>" :
                                    loading ? "TRANSMITTING..." :
                                        stage === 'round1' ? "COUNCIL CONVENED. CLICK TO DEBATE >>" :
                                            "AWAITING..."
                            }
                            className={`flex-1 bg-transparent text-cyan-100 font-mono text-lg focus:outline-none placeholder-cyan-900/50 resize-none overflow-hidden max-h-48 py-2 min-h-[48px] ${!hasKey ? 'cursor-pointer placeholder-red-500/50' : ''}`}
                        />

                        {stage === 'round1' ? (
                            <button
                                type="submit"
                                disabled={loading}
                                className={`shrink-0 font-bold border px-6 py-2 rounded-lg transition-all h-12 flex items-center gap-2 ${loading
                                    ? 'bg-blue-950 text-cyan-400 border-blue-900 shadow-inner animate-pulse cursor-wait'
                                    : 'text-cyan-950 bg-cyan-400 border-cyan-400 hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                                    }`}
                            >
                                <Cpu className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                <span className="hidden md:inline ml-2">
                                    {loading ? "CONVENING..." : stage === 'round1' ? "SYNTHESIZE VERDICT" : "CONVENE"}
                                </span>
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading || (!input.trim() && !selectedImage) || !hasKey}
                                onClick={(e) => {
                                    if (!hasKey) {
                                        e.preventDefault();
                                        setShowSettings(true);
                                    }
                                }}
                                className={`shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white w-12 h-12 rounded-lg font-bold flex items-center justify-center transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] ${!hasKey || loading || (!input.trim() && !selectedImage) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Cpu className="w-6 h-6" />
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}