'use client';

export default function PiHero() {
    return (
        // Shifted upwards with -mt-8 to accommodate user request
        <div className="relative flex flex-col items-center justify-center h-48 sm:h-64 w-full -mt-8">
            <svg
                viewBox="0 0 200 200"
                className="w-40 h-40 sm:w-56 sm:h-56 overflow-visible"
            >
                <defs>
                    {/* Gradient for Pi (Cyan to Blue) */}
                    <linearGradient id="piGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>

                    {/* Rainbow Gradient for Circle (Cyan -> Pink -> Green) */}
                    <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
                        <stop offset="50%" stopColor="#ec4899" /> {/* Pink */}
                        <stop offset="100%" stopColor="#22c55e" /> {/* Green */}
                    </linearGradient>
                </defs>

                {/* Serif Style Pi Path (Classic Math Font) */}
                {/* Scaled down to fit INSIDE the circle (approx bounds: 70,60 to 130,140) */}
                <path
                    d="
                        M 65 75 Q 65 60 75 65 L 125 65 Q 135 60 130 75
                        M 85 65 L 85 125 Q 80 135 70 130
                        M 115 65 L 115 125 Q 115 140 135 130
                    "
                    fill="none"
                    stroke="url(#piGradient)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-pi-draw"
                />

                {/* Rainbow Circle */}
                <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="url(#rainbowGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-circle-draw"
                    transform="rotate(-90 100 100)"
                />
            </svg>

            {/* Cyan Glassy Text */}
            <div className="absolute -bottom-4 opacity-0 animate-text-reveal">
                <span className="text-xl sm:text-2xl font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-b from-cyan-100 to-cyan-500 drop-shadow-[0_2px_10px_rgba(34,211,238,0.6)]">
                    WELCOME
                </span>
                {/* Reflection/Glass Shine Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-200/20 to-transparent skew-x-12 pointer-events-none"></div>
            </div>

            <style jsx>{`
                /* Total Animation Duration: 4s (1.5x speed) */
                
                .animate-pi-draw {
                    stroke-dasharray: 400;
                    stroke-dashoffset: 400;
                    animation: drawPi 4s ease-in-out infinite;
                }

                .animate-circle-draw {
                    stroke-dasharray: 600;
                    stroke-dashoffset: 600;
                    opacity: 0;
                    animation: drawCircle 4s ease-in-out infinite;
                }

                .animate-text-reveal {
                    animation: revealText 4s ease-in-out infinite;
                }

                @keyframes drawPi {
                    0% { stroke-dashoffset: 400; filter: drop-shadow(0 0 0px #22d3ee); }
                    25% { stroke-dashoffset: 0; filter: drop-shadow(0 0 5px #22d3ee); } 
                    85% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: 0; opacity: 0; }
                }

                @keyframes drawCircle {
                    0%, 20% { stroke-dashoffset: 600; opacity: 1; }
                    50% { stroke-dashoffset: 0; opacity: 1; filter: drop-shadow(0 0 8px rgba(236, 72, 153, 0.6)); }
                    85% { stroke-dashoffset: 0; opacity: 1; }
                    100% { stroke-dashoffset: 0; opacity: 0; }
                }

                @keyframes revealText {
                    0%, 45% { opacity: 0; transform: translateY(5px) scale(0.95); }
                    55% { opacity: 1; transform: translateY(0) scale(1); filter: drop-shadow(0 0 15px rgba(34,211,238,0.8)); }
                    85% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-5px) scale(1.05); }
                }
            `}</style>
        </div>
    );
}
