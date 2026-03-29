'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, AlertCircle, Play, Trophy, Calendar, Timer, ChevronRight, Sparkles, Lock, TrendingUp, Activity, Medal, Crown, Star } from 'lucide-react';

interface TestInfo {
    _id: string;
    title: string;
    description?: string;
    totalMarks: number;
    questionCount: number;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    attemptStatus: 'not_started' | 'in_progress' | 'completed';
    score?: number;
    percentage?: number;
    submittedAt?: string;
    resultsPending?: boolean;
}

interface AnalyticsData {
    totalTests: number;
    averageScore: number;
    recentScore: number;
    highestScore: number;
    missed: number;
    pending: number;
    trend: string;
    history: { testId: string; title: string; percentage: number; score: number; totalMarks: number; date: string }[];
    testComparison: { testId: string; title: string; studentScore: number; highestScore: number }[];
    batchHighestAverage: number;
    batchRank: number;
    totalBatchStudents: number;
    leaderboard: { name: string; phone: string; average: number; testsAttempted: number }[];
}

function getRemark(avg: number): { label: string; color: string; bg: string; border: string } {
    if (avg >= 90) return { label: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' };
    if (avg >= 75) return { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' };
    if (avg >= 50) return { label: 'Satisfactory', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' };
    if (avg >= 35) return { label: 'Poor', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' };
    return { label: 'Very Poor', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' };
}

const remarkLegend = [
    { min: 90, label: 'Excellent', color: 'bg-emerald-500' },
    { min: 75, label: 'Good', color: 'bg-blue-500' },
    { min: 50, label: 'Satisfactory', color: 'bg-amber-500' },
    { min: 35, label: 'Poor', color: 'bg-orange-500' },
    { min: 0, label: 'Very Poor', color: 'bg-red-500' },
];

export default function OnlineTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [available, setAvailable] = useState<TestInfo[]>([]);
    const [upcoming, setUpcoming] = useState<TestInfo[]>([]);
    const [completed, setCompleted] = useState<TestInfo[]>([]);
    const [expired, setExpired] = useState<TestInfo[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>('');

    useEffect(() => {
        // Initial load - fetch analytics first to determine batches
        fetchAnalytics();
    }, []);

    // Refetch when batch changes
    useEffect(() => {
        if (selectedBatch) {
            fetchTests(selectedBatch);
            fetchAnalytics(selectedBatch);
        }
    }, [selectedBatch]);

    const fetchTests = async (batch?: string) => {
        setLoading(true);
        try {
            const url = batch ? `/api/student/online-test?batch=${encodeURIComponent(batch)}` : '/api/student/online-test';
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                if (res.status === 401) { router.push('/student/login'); return; }
                throw new Error('Failed to fetch');
            }
            const data = await res.json();
            setAvailable(data.available || []);
            setUpcoming(data.upcoming || []);
            setCompleted(data.completed || []);
            setExpired(data.expired || []);
        } catch (error) {
            console.error('Error fetching tests:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalytics = async (batch?: string) => {
        // Only show loading if we don't have data or are switching batches (to avoid flash)
        if (!analytics || batch) setAnalyticsLoading(true);

        try {
            const url = batch ? `/api/student/analytics?batch=${encodeURIComponent(batch)}` : '/api/student/analytics';
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();

                // Initialize batches if not already done
                if (!batch && data.batches && data.batches.length > 0) {
                    if (batches.length === 0) setBatches(data.batches);

                    // Default to first batch if none selected
                    // This creates the "particular batch" view by default instead of "all"
                    if (!selectedBatch && data.batches && data.batches.length > 0) {
                        setSelectedBatch(data.batches[0]);
                        // CRITICAL: Return here to avoid setting aggregate data.
                        // The useEffect[selectedBatch] will trigger the specific fetch.
                        return;
                    }
                }

                // If we reached here, it means either:
                // 1. We requested a specific batch
                // 2. We requested initial (no batch) AND there are NO batches (so we show aggregate/empty)

                setAnalytics(data);

                // If this was initial load (no batch) and NO batches were found, we need to fetch tests manually here
                // (since useEffect won't trigger)
                if (!batch && (!data.batches || data.batches.length === 0)) {
                    fetchTests();
                }
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Kolkata' });
        const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        return `${date} & ${time}`;
    };

    const getTimeRemaining = (dateStr: string) => {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return 'Starting now';
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    // Build a map from testId -> highestScore for quick lookup in History cards
    const comparisonMap = new Map<string, number>();
    if (analytics?.testComparison) {
        analytics.testComparison.forEach(tc => comparisonMap.set(tc.testId, tc.highestScore));
    }

    // SVG polyline for consistency chart
    const generatePolylinePoints = () => {
        const history = analytics?.history || [];
        if (history.length === 0) return "";
        if (history.length === 1) return "50,20";
        const width = 100;
        const height = 40;
        const step = width / (history.length - 1);
        return history.map((t, i) => {
            const x = i * step;
            const y = height - ((t.percentage || 0) / 100) * height;
            return `${x},${y}`;
        }).join(" ");
    };

    const generateAreaPoints = () => {
        const history = analytics?.history || [];
        if (history.length < 2) return "";
        const pts = generatePolylinePoints();
        const step = 100 / (history.length - 1);
        return `0,40 ${pts} 100,40`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading tests...</p>
                </div>
            </div>
        );
    }

    const remark = analytics ? getRemark(analytics.averageScore) : null;

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/5 blur-[120px]"></div>
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

            <main className="max-w-7xl mx-auto px-4 py-2 sm:py-6 relative z-10 space-y-8">

                {/* ===== BATCH SELECTION TABS ===== */}
                {batches.length > 0 && (
                    <div className="flex overflow-x-auto pb-4 gap-3 mb-6 no-scrollbar snap-x">
                        {batches.map((batch, index) => {
                            // Generate a unique prominent gradient for each batch based on index
                            const gradients = [
                                'from-blue-600 to-indigo-600 shadow-blue-500/25',
                                'from-emerald-600 to-teal-600 shadow-emerald-500/25',
                                'from-violet-600 to-purple-600 shadow-violet-500/25',
                                'from-amber-500 to-orange-600 shadow-amber-500/25',
                                'from-rose-600 to-pink-600 shadow-rose-500/25',
                                'from-cyan-600 to-sky-600 shadow-cyan-500/25'
                            ];
                            const activeGradient = gradients[index % gradients.length];

                            return (
                                <button
                                    key={batch}
                                    onClick={() => setSelectedBatch(batch)}
                                    className={`
                                        relative group px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 transform flex-shrink-0 snap-center
                                        ${selectedBatch === batch
                                            ? `bg-gradient-to-r ${activeGradient} text-white shadow-lg scale-105 ring-2 ring-white/20`
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10'
                                        }
                                    `}
                                >
                                    {selectedBatch === batch && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                        </span>
                                    )}
                                    <span className="relative z-10 flex items-center gap-2">
                                        {batch}
                                        {selectedBatch === batch && <Sparkles className="h-3 w-3" />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ===== ANALYTICS DASHBOARD ===== */}
                {!analyticsLoading && analytics && analytics.totalTests > 0 && (
                    <section className="space-y-6">
                        {/* Row 1: Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4">
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Your Avg Score</div>
                                <div className="text-xl sm:text-3xl font-black text-white">{analytics.averageScore}%</div>
                            </div>
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4">
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Batch Topper Avg</div>
                                <div className="text-xl sm:text-3xl font-black text-amber-400">{analytics.batchHighestAverage}%</div>
                            </div>
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4">
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Your Highest Score</div>
                                <div className="text-xl sm:text-3xl font-black text-emerald-400">{analytics.highestScore}%</div>
                            </div>
                            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-4">
                                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Batch Rank</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl sm:text-3xl font-black text-indigo-300">#{analytics.batchRank}</span>
                                    <span className="text-[10px] text-slate-500">/ {analytics.totalBatchStudents}</span>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Remark (compact) + Consistency (wider) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Student Remark Card (1 col) */}
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-6 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Student Remark</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Based on your average</p>
                                    </div>
                                    <Star className="h-4 w-4 text-slate-600" />
                                </div>

                                {/* Big remark badge */}
                                {remark && (
                                    <div className={`${remark.bg} ${remark.border} border rounded-xl px-4 py-3 mb-4 text-center`}>
                                        <div className={`text-base sm:text-xl font-black ${remark.color}`}>{remark.label}</div>
                                        <div className="text-[9px] text-slate-400 mt-1">{analytics.averageScore}% average</div>
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="space-y-1.5 mt-auto">
                                    {remarkLegend.map((r, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px]">
                                            <span className={`w-2.5 h-2.5 rounded-sm ${r.color} flex-shrink-0`}></span>
                                            <span className="text-slate-400 flex-1">{r.label}</span>
                                            <span className="text-slate-600">{r.min === 0 ? '< 35%' : `≥ ${r.min}%`}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Consistency Chart (2 cols - wider) */}
                            <div className="lg:col-span-2 bg-slate-900/80 border border-white/5 rounded-2xl p-6 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Consistency</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Performance trend across tests</p>
                                    </div>
                                    <TrendingUp className="h-4 w-4 text-slate-600" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    {analytics.history.length > 0 ? (
                                        <>
                                            <div className="relative h-28 w-full mb-3">
                                                {/* Grid lines */}
                                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                                    {[100, 75, 50, 25, 0].map(v => (
                                                        <div key={v} className="flex items-center gap-2">
                                                            <span className="text-[8px] text-slate-700 w-6 text-right">{v}%</span>
                                                            <div className="flex-1 border-b border-white/5"></div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="absolute inset-0 pl-8">
                                                    <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                                                        <defs>
                                                            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                <stop offset="0%" stopColor="#34d399" />
                                                                <stop offset="100%" stopColor="#3b82f6" />
                                                            </linearGradient>
                                                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                                                                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                                                            </linearGradient>
                                                        </defs>
                                                        {analytics.history.length > 1 && (
                                                            <polygon fill="url(#areaGrad)" points={generateAreaPoints()} />
                                                        )}
                                                        <polyline
                                                            fill="none"
                                                            stroke="url(#lineGrad)"
                                                            strokeWidth="2.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            points={generatePolylinePoints()}
                                                            vectorEffect="non-scaling-stroke"
                                                        />
                                                        {analytics.history.map((h, i) => {
                                                            const len = analytics.history.length;
                                                            const x = len > 1 ? i * (100 / (len - 1)) : 50;
                                                            const y = 40 - (h.percentage / 100) * 40;
                                                            return (
                                                                <circle key={i} cx={x} cy={y} r="4" fill="#050b14" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                                            );
                                                        })}
                                                    </svg>
                                                </div>
                                            </div>
                                            {/* Test labels */}
                                            <div className="flex justify-between text-[9px] text-slate-500 pl-8">
                                                {analytics.history.map((h, i) => (
                                                    <span key={i} className="text-center truncate max-w-[60px]" title={h.title}>
                                                        {h.percentage}%
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-28 flex items-center justify-center text-slate-600 text-sm">Take more tests to see trends</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Leaderboard */}
                        {analytics.leaderboard.length > 0 && (
                            <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-4 sm:p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                        <Crown className="h-5 w-5 text-amber-400" />
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Batch Leaderboard</h3>
                                            <p className="text-[10px] text-slate-500">Cumulative average across all tests</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                        <Medal className="h-3 w-3 text-indigo-400" />
                                        <span className="text-[10px] sm:text-xs font-bold text-indigo-300">Your Rank: #{analytics.batchRank}</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                                                <th className="text-left py-3 px-1.5 w-10">#</th>
                                                <th className="text-left py-3 px-1.5">Student</th>
                                                <th className="text-center py-3 px-1.5 whitespace-nowrap">Tests</th>
                                                <th className="text-right py-3 px-1.5">Average</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analytics.leaderboard.map((entry, i) => {
                                                const isCurrentStudent = entry.phone !== '***';
                                                return (
                                                    <tr key={i} className={`border-b border-white/5 transition-colors ${isCurrentStudent ? 'bg-emerald-500/5' : 'hover:bg-white/5'}`}>
                                                        <td className="py-2.5 px-1.5">
                                                            {i === 0 ? <span className="text-base">🥇</span> :
                                                                i === 1 ? <span className="text-base">🥈</span> :
                                                                    i === 2 ? <span className="text-base">🥉</span> :
                                                                        <span className="text-slate-500 font-bold text-xs">{i + 1}</span>}
                                                        </td>
                                                        <td className="py-2.5 px-1.5">
                                                            <div className="flex flex-col">
                                                                <span className={`font-medium text-xs sm:text-sm whitespace-nowrap ${isCurrentStudent ? 'text-emerald-300' : 'text-slate-300'}`}>
                                                                    {entry.name}
                                                                </span>
                                                                {isCurrentStudent && <span className="text-[8px] text-emerald-500">(You)</span>}
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-1.5 text-center text-slate-400 text-xs">{entry.testsAttempted}</td>
                                                        <td className="py-2.5 px-1.5 text-right">
                                                            <span className={`font-bold text-xs sm:text-sm ${entry.average >= 80 ? 'text-emerald-400' : entry.average >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                {entry.average}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Loading state for analytics */}
                {analyticsLoading && (
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-8 text-center">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-slate-500">Loading analytics...</p>
                    </div>
                )}

                {/* ===== SPLIT VIEW: ACTIVE + HISTORY ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* LEFT: Active Zone */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-emerald-500/20">
                                <Play className="h-4 w-4 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200">
                                Active Zone
                            </h2>
                        </div>

                        {available.length === 0 && upcoming.length === 0 && (
                            <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-slate-500">
                                <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                <p>No active tests at the moment.</p>
                            </div>
                        )}

                        {available.map(test => (
                            <div key={test._id} className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="relative bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 hover:border-emerald-500/50 transition-all shadow-xl shadow-emerald-900/10">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-black uppercase">Live</span>
                                                <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Timer className="h-3 w-3" /> {test.durationMinutes}m
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-white text-sm sm:text-lg mb-2 truncate">{test.title}</h3>
                                            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                                                <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-emerald-400" />{test.questionCount} Qs</span>
                                                <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-400" />{test.totalMarks} Marks</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/student/online-test/${test._id}`)}
                                            className="self-center px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95"
                                        >
                                            {test.attemptStatus === 'in_progress' ? 'Resume' : 'Start'}
                                        </button>
                                    </div>
                                    {test.endTime && (
                                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-300">
                                            <Clock className="h-3 w-3" />
                                            <span>Ends in {getTimeRemaining(test.endTime)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {upcoming.map(test => (
                            <div key={test._id} className="relative group">
                                <div className="relative bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5 hover:border-amber-500/40 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase border border-amber-500/20">Upcoming</span>
                                            </div>
                                            <h3 className="font-bold text-white text-xs sm:text-base mb-1 truncate">{test.title}</h3>
                                            <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                                                <span>{test.questionCount} Qs</span>
                                                <span>{test.totalMarks} Marks</span>
                                                <span>{test.durationMinutes} min</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl border border-white/5 min-w-[80px]">
                                            <Clock className="h-5 w-5 text-amber-400 mb-1" />
                                            <span className="text-[10px] text-slate-400">Starts in</span>
                                            <span className="text-xs font-bold text-white">{test.startTime && getTimeRemaining(test.startTime)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: History Zone */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Trophy className="h-4 w-4 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                                History
                            </h2>
                        </div>

                        {completed.length === 0 && expired.length === 0 && (
                            <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-slate-500">
                                <p>No test history yet.</p>
                            </div>
                        )}

                        {completed.map(test => {
                            const batchHighest = comparisonMap.get(test._id);
                            const pct = test.percentage || 0;
                            return (
                                <div
                                    key={test._id}
                                    className={`relative group ${test.resultsPending ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                    onClick={() => !test.resultsPending && router.push(`/student/online-test/${test._id}/result`)}
                                >
                                    <div className="relative bg-slate-900/40 border border-blue-500/10 rounded-2xl p-5 hover:bg-slate-900/60 hover:border-blue-500/30 transition-all active:scale-[0.98]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-200 text-xs mb-2 truncate group-hover:text-white transition-colors">{test.title}</h3>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                    <span className="text-slate-400">{formatDate(test.submittedAt || '')}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                    <span>{test.totalMarks} Marks</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                {test.resultsPending ? (
                                                    // Pending State
                                                    <div className="flex flex-col items-end">
                                                        <div className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase tracking-wider mb-1">
                                                            Pending
                                                        </div>
                                                        <span className="text-[9px] text-slate-500 text-right w-32">
                                                            Come back at {test.endTime ? formatDate(test.endTime) : 'Later'} to view your results.
                                                        </span>
                                                    </div>
                                                ) : (
                                                    // Published State
                                                    <>
                                                        <div className={`text-lg font-black ${pct >= 40 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {pct}%
                                                        </div>
                                                        <span className="text-[9px] text-blue-400 font-bold mt-1 flex items-center gap-1">
                                                            View Result <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Per-test comparison: You vs Batch Highest (Only if not pending) */}
                                        {!test.resultsPending && batchHighest !== undefined && (
                                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-500 w-24 flex-shrink-0">Your score</span>
                                                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 2)}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-400 w-8 text-right">{pct}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-500 w-24 flex-shrink-0">Topper&apos;s score</span>
                                                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-amber-500/60 rounded-full transition-all duration-700" style={{ width: `${Math.max(batchHighest, 2)}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-amber-400 w-8 text-right">{batchHighest}%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {expired.map(test => (
                            <div key={test._id} className="relative group">
                                <div className="relative bg-slate-900/20 border border-red-500/10 rounded-2xl p-4 hover:border-red-500/30 transition-all">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/10">MISSED</span>
                                                <h3 className="font-bold text-slate-300 text-sm truncate">{test.title}</h3>
                                            </div>
                                            <div className="text-[10px] text-slate-600">Ended {formatDate(test.endTime || '')}</div>
                                        </div>
                                        <Lock className="h-4 w-4 text-slate-700 group-hover:text-red-400 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
