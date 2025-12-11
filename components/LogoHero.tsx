'use client';

import Image from 'next/image';

export default function LogoHero() {
    return (
        <div className="relative flex items-center justify-center w-64 h-64 sm:w-80 sm:h-80">
            {/* 1. Animated Light Ray Ring (Outer Boundary) */}
            <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke="url(#rayGradient)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        className="animate-ray-draw"
                    />
                    <defs>
                        <linearGradient id="rayGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="transparent" />
                            <stop offset="50%" stopColor="#22d3ee" /> {/* Cyan */}
                            <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* 2. Main Logo Image */}
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 z-10">
                <Image
                    src="/hero-logo.png"
                    alt="Education Portal"
                    fill
                    className="object-contain" // Preserves aspect ratio
                    priority
                />

                {/* 3. Bulb Glow Animation (Overlay) */}
                {/* Positioned roughly over the bulb area (approx: top-left-center) */}
                <div
                    className="absolute top-[25%] left-[28%] w-[20%] h-[25%] rounded-full bg-orange-400/60 blur-[20px] mix-blend-screen animate-pulse-glow pointer-events-none"
                    style={{ animationDuration: '3s' }}
                ></div>

                {/* Optional: Second subtle glow for the book/general ambiance */}
                <div
                    className="absolute bottom-[20%] left-[20%] w-[60%] h-[20%] rounded-full bg-blue-500/20 blur-[30px] mix-blend-screen animate-pulse pointer-events-none delay-700"
                ></div>
            </div>

            <style jsx>{`
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                
                .animate-ray-draw {
                    stroke-dasharray: 100 200; /* Create a gap for the "ray" look */
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
            `}</style>
        </div>
    );
}
