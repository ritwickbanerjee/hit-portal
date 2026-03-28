'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Wrench, Clock } from 'lucide-react';

export default function OnlineTestPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/5 blur-[120px]"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <button onClick={() => router.push('/student')} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h1 className="text-sm font-bold text-white">Online<span className="text-emerald-400">Tests</span></h1>
                </div>
            </header>

            {/* Maintenance Content */}
            <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-56px)] relative z-10 px-4">
                <div className="text-center max-w-sm w-full">
                    {/* Animated icon */}
                    <div className="relative inline-flex items-center justify-center mb-8">
                        <div className="absolute w-28 h-28 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: '2.5s' }}></div>
                        <div className="absolute w-20 h-20 rounded-full bg-amber-500/15 animate-ping" style={{ animationDuration: '2s' }}></div>
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center shadow-2xl shadow-amber-900/30">
                            <Wrench className="h-10 w-10 text-amber-400" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-3">
                        Under <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Maintenance</span>
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        The Online Test portal is currently undergoing scheduled maintenance.
                        It will be back up shortly. Please check back later.
                    </p>

                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>We&apos;ll be back soon. Thank you for your patience.</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
