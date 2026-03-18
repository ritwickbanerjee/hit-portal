'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Clock, Loader2, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';

interface RoutineItem {
    time: string;
    group: string;
    content: string;
}

export default function MyRoutinePage() {
    const [routine, setRoutine] = useState<Record<string, RoutineItem[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState("");
    const [facultyCode, setFacultyCode] = useState("");

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setFacultyCode(user.name); 
            } catch (e) {
                setError("Failed to identify user faculty code.");
            }
        }

        const today = new Date().getDay(); 
        const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const currentDay = dayNames[today];
        setActiveDay(days.includes(currentDay) ? currentDay : "MON");
    }, []);

    useEffect(() => {
        if (!facultyCode) return;

        async function fetchRoutine() {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/routine?facultyCode=${encodeURIComponent(facultyCode)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch routine');
                
                setRoutine(data.routine);
                setError(null);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchRoutine();
    }, [facultyCode]);

    // Enhanced Vibrant Color Palette
    const colors = [
        {
            bg: "bg-rose-500/20",
            border: "border-rose-400/50",
            text: "text-rose-100",
            accent: "bg-rose-400",
            glow: "shadow-rose-500/20"
        },
        {
            bg: "bg-indigo-500/20",
            border: "border-indigo-400/50",
            text: "text-indigo-100",
            accent: "bg-indigo-400",
            glow: "shadow-indigo-500/20"
        },
        {
            bg: "bg-emerald-500/20",
            border: "border-emerald-400/50",
            text: "text-emerald-100",
            accent: "bg-emerald-400",
            glow: "shadow-emerald-500/20"
        },
        {
            bg: "bg-amber-500/20",
            border: "border-amber-400/50",
            text: "text-amber-100",
            accent: "bg-amber-400",
            glow: "shadow-amber-500/20"
        },
        {
            bg: "bg-violet-500/20",
            border: "border-violet-400/50",
            text: "text-violet-100",
            accent: "bg-violet-400",
            glow: "shadow-violet-500/20"
        },
        {
            bg: "bg-cyan-500/20",
            border: "border-cyan-400/50",
            text: "text-cyan-100",
            accent: "bg-cyan-400",
            glow: "shadow-cyan-500/20"
        },
        {
            bg: "bg-fuchsia-500/20",
            border: "border-fuchsia-400/50",
            text: "text-fuchsia-100",
            accent: "bg-fuchsia-400",
            glow: "shadow-fuchsia-500/20"
        }
    ];

    const getCardStyles = (content: string, index: number) => {
        // Deterministic color based on content hash
        const hash = content.length + index;
        return colors[hash % colors.length];
    };

    const parseContent = (content: string) => {
        const parts = content.split('\n');
        const main = parts[0];
        const room = parts[1]?.replace('Room No.-', '') || "";
        
        const mainParts = main.split('/');
        const type = mainParts[0] || "";
        const subject = mainParts[1] || "";
        const topic = mainParts[2] || "";

        return { type, subject, topic, room };
    };

    if (loading && !Object.keys(routine).length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse">Syncing your routine...</p>
            </div>
        );
    }

    const currentDayRoutine = routine[activeDay] || [];

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20 px-2 sm:px-0">
            {/* Header */}
            <div className="flex items-center justify-between py-4">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-black text-white flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] animate-pulse">
                            <CalendarDays className="h-7 w-7 text-white" />
                        </div>
                        <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                            My Schedule
                        </span>
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        Faculty ID: <span className="text-indigo-400 font-bold tracking-widest">{facultyCode}</span>
                    </p>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl flex items-center gap-4 text-red-400 backdrop-blur-xl">
                    <AlertCircle className="h-6 w-6 shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Day Tabs - Mobile Friendly Scroll */}
            <div className="sticky top-0 z-30 py-4 -mx-2 px-2 bg-slate-950/80 backdrop-blur-xl">
                <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar snap-x">
                    {days.map((day) => (
                        <button
                            key={day}
                            onClick={() => setActiveDay(day)}
                            className={`flex-none w-24 sm:w-32 py-3 px-4 rounded-2xl border-2 transition-all duration-500 font-black text-xs snap-start ${
                                activeDay === day
                                    ? 'bg-gradient-to-br from-indigo-600 to-violet-700 border-indigo-400 text-white shadow-[0_15px_25px_-5px_rgba(79,70,229,0.4)] scale-105'
                                    : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-200 hover:border-white/10'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </div>

            {/* Routine List - Vertical and Optimized for Mobile */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {currentDayRoutine.length > 0 ? (
                    currentDayRoutine.map((item, idx) => {
                        const { type, subject, topic, room } = parseContent(item.content);
                        const styles = getCardStyles(item.content, idx);
                        
                        return (
                            <div 
                                key={idx}
                                className={`relative group p-6 rounded-[2.5rem] border-2 backdrop-blur-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 delay-[${idx * 100}ms] ${styles.bg} ${styles.border} ${styles.glow}`}
                            >
                                {/* Glow Accent */}
                                <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${styles.accent}`}></div>
                                
                                <div className="flex flex-col h-full space-y-6">
                                    {/* Time and Type */}
                                    <div className="flex items-center justify-between">
                                        <div className={`flex items-center gap-2 font-black text-xs tracking-wider px-4 py-2 rounded-full bg-black/40 ${styles.text}`}>
                                            <Clock className="h-3.5 w-3.5" />
                                            {item.time}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-60`}>
                                            {type === 'L' ? 'Lecture' : 'Tutorial'}
                                        </span>
                                    </div>

                                    {/* Subject Main */}
                                    <div>
                                        <h3 className={`text-3xl font-black tracking-tight mb-2 leading-none transition-transform group-hover:scale-[1.02] origin-left ${styles.text}`}>
                                            {subject}
                                        </h3>
                                        <p className="text-sm font-medium text-slate-300/80 leading-relaxed min-h-[2.5rem] line-clamp-2">
                                            {topic}
                                        </p>
                                    </div>

                                    {/* Footer Details */}
                                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-2xl bg-black/40 ${styles.text}`}>
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] block opacity-50 font-bold uppercase tracking-widest">Room No</span>
                                                <span className={`text-lg font-black tracking-wider ${styles.text}`}>{room}</span>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1`}>
                                            <ChevronRight className="h-6 w-6" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-32 bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-slate-600 backdrop-blur-sm">
                        <CalendarDays className="h-20 w-20 mb-6 opacity-10" />
                        <p className="text-2xl font-black italic tracking-tight opacity-40 uppercase">No sessions for {activeDay}</p>
                    </div>
                )}
            </div>

            {/* Mobile Footer Decor */}
            <div className="flex items-center justify-center gap-2 pt-10 opacity-20">
                <div className="h-1 w-1 rounded-full bg-white"></div>
                <div className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"></div>
                <div className="h-1 w-1 rounded-full bg-white"></div>
            </div>

            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
        </div>
    );
}
