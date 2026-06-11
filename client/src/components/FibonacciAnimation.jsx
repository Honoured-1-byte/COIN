import React from 'react';

const FibonacciAnimation = () => {
    return (
        <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            {/* 
                Main Container 
                - Mobile: Rotated 90deg (Vertical)
                - Desktop: No rotation (Horizontal)
                - Size: Large to cover significant screen area
            */}
            <div className="relative w-[140vw] h-[140vw] md:w-[70vw] md:h-[45vw] transition-transform duration-700 ease-in-out rotate-90 md:rotate-0 opacity-40">
                <svg viewBox="0 0 162 100" className="w-full h-full overflow-visible">
                    {/* Definitions for Golden/Red Glow */}
                    <defs>
                        <linearGradient id="goldenSpiralGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#B45309" stopOpacity="0" /> {/* Dark Amber */}
                            <stop offset="50%" stopColor="#F59E0B" stopOpacity="1" /> {/* Bright Amber */}
                            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.8" /> {/* Red */}
                        </linearGradient>
                        <filter id="goldenGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* 
                        SQUARES LAYER 
                        - Fixed in grid position vs each other.
                        - Each square rotates on its OWN center.
                    */}
                    <g className="stroke-amber-700/50 stroke-[0.3] fill-transparent">
                        {/* Rect 21 */}
                        <rect x="0" y="0" width="100" height="100" className="origin-center animate-[spin_60s_linear_infinite]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 13 */}
                        <rect x="100" y="0" width="62" height="62" className="origin-center animate-[spin_50s_linear_infinite_reverse]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 8 */}
                        <rect x="124" y="62" width="38" height="38" className="origin-center animate-[spin_40s_linear_infinite]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 5 */}
                        <rect x="100" y="76" width="24" height="24" className="origin-center animate-[spin_30s_linear_infinite_reverse]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 3 */}
                        <rect x="100" y="62" width="14" height="14" className="origin-center animate-[spin_20s_linear_infinite]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 2 */}
                        <rect x="114" y="62" width="10" height="10" className="origin-center animate-[spin_15s_linear_infinite_reverse]" style={{ transformBox: 'fill-box' }} />
                        {/* Rect 1 */}
                        <rect x="114" y="72" width="6" height="6" className="origin-center animate-[spin_10s_linear_infinite]" style={{ transformBox: 'fill-box' }} />
                    </g>

                    {/* 
                        THE GOLDEN SPIRAL CURVE 
                        - Pulses
                        - Connected structure (does NOT rotate with squares)
                    */}
                    <path
                        d="M0,100 A100,100 0 0,1 100,0 A62,62 0 0,1 162,62 A38,38 0 0,1 124,100 A24,24 0 0,1 100,76 A14,14 0 0,1 114,62 A10,10 0 0,1 124,72"
                        fill="none"
                        stroke="url(#goldenSpiralGradient)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]"
                    >
                        {/* Dash Offset Animation for "Flowing" Energy */}
                        <animate attributeName="stroke-dasharray" values="0,350;350,0;0,350" dur="8s" repeatCount="indefinite" />
                        <animate attributeName="stroke-dashoffset" from="350" to="-350" dur="8s" repeatCount="indefinite" />
                    </path>

                    {/* 
                        NUMBERS 
                        - Fixed Position (They don't rotate)
                        - Red/Gold Contrast
                    */}
                    <g className="fill-red-500/60 font-mono text-[3px] select-none font-bold">
                        <text x="50" y="50" textAnchor="middle" alignmentBaseline="middle">21</text>
                        <text x="131" y="31" textAnchor="middle" alignmentBaseline="middle">13</text>
                        <text x="143" y="81" textAnchor="middle" alignmentBaseline="middle">8</text>
                        <text x="112" y="88" textAnchor="middle" alignmentBaseline="middle">5</text>
                    </g>
                </svg>
            </div>
        </div>
    );
};

export default FibonacciAnimation;
