'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Users, Trophy, Clock, XCircle, RefreshCw, BarChart3, Target, TrendingUp, Award, Percent, RotateCcw, CalendarClock, Eye } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import SubmissionReviewModal from '../components/SubmissionReviewModal';

interface Analytics {
    totalStudents: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
    participationRate: number;
    averageScore?: number;
    highestScore?: number;
    lowestScore?: number;
    averagePercentage?: number;
    passRate?: number;
    passedCount?: number;
    failedCount?: number;
    medianScore?: number;
    scoreDistribution?: { range: string; count: number }[];
    batchPerformance?: { batch: string; avgPercentage: number; studentCount: number }[];
    questionAnalysis?: { questionId: string; text: string; type: string; correctCount: number; totalAttempts: number; accuracy: number }[];
    terminationReason?: string;
}

interface StudentResult {
    name: string;
    phone: string;
    batch: string;
    score: number;
    percentage: number;
    submittedAt: string;
    timeSpent: number;
    graceMarks: number;
    terminationReason?: string;
    windowSwitchCount?: number;
    screenshotCount?: number;
    violations?: { type: string; timestamp: string; details: string }[];
}

export default function MonitorTestPage() {
    const router = useRouter();
    const routeParams = useParams();
    const testId = routeParams?.id as string;
    const [testInfo, setTestInfo] = useState<any>(null);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [completed, setCompleted] = useState<any[]>([]);
    const [inProgress, setInProgress] = useState<any[]>([]);
    const [notStarted, setNotStarted] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'analytics' | 'all' | 'completed' | 'inProgress' | 'notStarted'>('analytics');
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Reassign completed students state
    const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    // Reassign missed students state
    const [showMissedModal, setShowMissedModal] = useState(false);
    const [missedReassigning, setMissedReassigning] = useState(false);
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');

    // Submission Review Modal state
    const [reviewStudentPhone, setReviewStudentPhone] = useState<string | null>(null);

    // Force-complete expired students
    const [forceCompleting, setForceCompleting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserEmail(user.email);
        }
    }, []);

    useEffect(() => {
        if (userEmail) fetchResults();
    }, [userEmail]);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const headers: Record<string, string> = {};
            if (userEmail) headers['X-User-Email'] = userEmail;
            // Send global admin key if active
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }
            const res = await fetch(`/api/admin/online-test/${testId}/results`, {
                headers
            });
            if (res.ok) {
                const data = await res.json();
                setTestInfo(data.test);
                setAnalytics(data.analytics);
                setCompleted(data.completed);
                setInProgress(data.inProgress);
                setNotStarted(data.notStarted);
                setSelectedPhones(new Set()); // Clear selection on refresh
            } else {
                const data = await res.json().catch(() => ({ error: 'Unknown API error' }));
                console.error(`[MonitorAPI] Error ${res.status}:`, data);
                toast.error(`Error ${res.status}: ${data.error || 'Failed to load test results'}`);
            }
        } catch (err: any) {
            console.error('[MonitorPage] Network/Runtime error:', err);
            toast.error('Error loading results: ' + (err.message || 'Network error'));
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    const maxDistCount = analytics?.scoreDistribution ? Math.max(...analytics.scoreDistribution.map(d => d.count), 1) : 1;

    // --- Reassign helpers ---
    const toggleSelectPhone = (phone: string) => {
        setSelectedPhones(prev => {
            const next = new Set(prev);
            if (next.has(phone)) next.delete(phone);
            else next.add(phone);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedPhones.size === completed.length) {
            setSelectedPhones(new Set());
        } else {
            setSelectedPhones(new Set(completed.map(s => s.phone)));
        }
    };

    const handleReassign = async () => {
        if (selectedPhones.size === 0) return;
        setReassigning(true);
        try {
            const res = await fetch(`/api/admin/online-test/${testId}/reassign`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify({ phones: Array.from(selectedPhones) })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Students reassigned successfully');
                setShowReassignModal(false);
                fetchResults();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to reassign');
            }
        } catch {
            toast.error('Network error while reassigning');
        } finally {
            setReassigning(false);
        }
    };

    const selectedStudents = completed.filter(s => selectedPhones.has(s.phone));

    // --- Handle missed reassign ---
    const handleMissedReassign = async () => {
        if (!newStartTime || !newEndTime) {
            toast.error('Please set both start and end times');
            return;
        }
        setMissedReassigning(true);
        try {
            const res = await fetch(`/api/admin/online-test/${testId}/reassign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail!
                },
                body: JSON.stringify({ newStartTime, newEndTime })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Test reassigned for missed students!');
                setShowMissedModal(false);
                fetchResults();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to reassign');
            }
        } catch {
            toast.error('Network error while reassigning');
        } finally {
            setMissedReassigning(false);
        }
    };

    // Force-complete expired in-progress tests
    const handleForceComplete = async () => {
        setForceCompleting(true);
        try {
            const res = await fetch(`/api/admin/online-test/${testId}/auto-complete`, {
                method: 'POST',
                headers: { 'X-User-Email': userEmail! }
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Expired tests auto-completed!');
                fetchResults();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to force-complete');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setForceCompleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <Toaster position="top-right" />

            {/* Submission Review Modal */}
            {reviewStudentPhone && userEmail && (
                <SubmissionReviewModal
                    testId={testId}
                    phone={reviewStudentPhone}
                    userEmail={userEmail}
                    onClose={() => setReviewStudentPhone(null)}
                    onSuccess={() => {
                        setReviewStudentPhone(null);
                        fetchResults();
                    }}
                />
            )}

            {/* Reassign Confirmation Modal */}
            {showReassignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                                <RotateCcw className="w-5 h-5 text-amber-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white">Reassign Test</h2>
                        </div>

                        <p className="text-slate-400 text-sm mb-4">
                            The following {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} will have their attempt <span className="text-red-400 font-bold">permanently deleted</span> so they can retake the test. All other test settings remain unchanged.
                        </p>

                        <div className="bg-slate-900/60 rounded-xl border border-white/5 divide-y divide-white/5 mb-6 max-h-48 overflow-y-auto">
                            {selectedStudents.map(s => (
                                <div key={s.phone} className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <p className="text-white text-sm font-medium">{s.name}</p>
                                        <p className="text-slate-500 text-xs">{s.phone} · {s.batch}</p>
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold">{s.score}/{testInfo?.totalMarks} ({s.percentage}%)</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReassignModal(false)}
                                disabled={reassigning}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 text-sm font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReassign}
                                disabled={reassigning}
                                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition-all"
                            >
                                {reassigning ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Reassigning...</>
                                ) : (
                                    <><RotateCcw className="w-4 h-4" /> Confirm Reassign</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Missed Students Reassign Modal */}
            {showMissedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <CalendarClock className="w-5 h-5 text-blue-400" />
                            </div>
                            <h2 className="text-lg font-bold text-white">Reassign Missed Students</h2>
                        </div>

                        <p className="text-slate-400 text-sm mb-4">
                            Set a new time window so that <span className="text-blue-400 font-bold">{notStarted.length} missed student{notStarted.length !== 1 ? 's' : ''}</span> can take this test. The test status will be set back to <span className="text-emerald-400 font-bold">Deployed</span>. Students who already completed are not affected.
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs text-slate-400 font-semibold mb-1.5">New Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={newStartTime}
                                    onChange={e => setNewStartTime(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 font-semibold mb-1.5">New End Time</label>
                                <input
                                    type="datetime-local"
                                    value={newEndTime}
                                    onChange={e => setNewEndTime(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMissedModal(false)}
                                disabled={missedReassigning}
                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 text-sm font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleMissedReassign}
                                disabled={missedReassigning || !newStartTime || !newEndTime}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition-all"
                            >
                                {missedReassigning ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Updating...</>
                                ) : (
                                    <><CalendarClock className="w-4 h-4" /> Confirm Reassign</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-slate-900/60 backdrop-blur-sm border-b border-white/10 p-6">
                <div className="max-w-7xl mx-auto">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors">
                        <ArrowLeft className="h-5 w-5" /> Back to Tests
                    </button>
                    {testInfo && (
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-1">{testInfo.title}</h1>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                    <span>📚 {testInfo.batches?.join(', ')}</span>
                                    <span>⏱️ {testInfo.duration} min</span>
                                    <span>📝 {testInfo.totalMarks} marks</span>
                                    <span>🎯 Pass: {testInfo.passingPercentage}%</span>
                                </div>
                            </div>
                            <button onClick={fetchResults} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-medium self-start">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Top Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div onClick={() => setActiveTab('all')} className={`border rounded-xl p-4 text-center cursor-pointer transition-all hover:ring-1 hover:ring-blue-500/30 ${activeTab === 'all' ? 'ring-2 ring-blue-400/60 bg-blue-500/10' : 'bg-slate-800/50 border-white/10'}`}>
                        <Users className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-white">{analytics?.totalStudents || 0}</div>
                        <div className="text-xs text-slate-500">Total Students</div>
                    </div>
                    <div onClick={() => setActiveTab('completed')} className={`border rounded-xl p-4 text-center cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500/50 ${activeTab === 'completed' ? 'ring-2 ring-emerald-500/60 bg-emerald-500/15' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                        <Trophy className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-emerald-400">{analytics?.completedCount || 0}</div>
                        <div className="text-xs text-slate-500">Completed</div>
                    </div>
                    <div onClick={() => setActiveTab('inProgress')} className={`border rounded-xl p-4 text-center cursor-pointer transition-all hover:ring-1 hover:ring-blue-500/50 ${activeTab === 'inProgress' ? 'ring-2 ring-blue-500/60 bg-blue-500/15' : 'bg-blue-500/10 border-blue-500/20'}`}>
                        <Clock className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-blue-400">{analytics?.inProgressCount || 0}</div>
                        <div className="text-xs text-slate-500">In Progress</div>
                    </div>
                    <div onClick={() => setActiveTab('notStarted')} className={`border rounded-xl p-4 text-center cursor-pointer transition-all hover:ring-1 hover:ring-red-500/50 ${activeTab === 'notStarted' ? 'ring-2 ring-red-500/60 bg-red-500/15' : 'bg-red-500/10 border-red-500/20'}`}>
                        <XCircle className="h-5 w-5 text-red-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-red-400">{analytics?.notStartedCount || 0}</div>
                        <div className="text-xs text-slate-500">Not Started</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                        <Percent className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                        <div className="text-2xl font-bold text-purple-400">{analytics?.participationRate || 0}%</div>
                        <div className="text-xs text-slate-500">Participation</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-800/30 rounded-xl p-1 mb-6 overflow-x-auto">
                    {[
                        { key: 'analytics', label: '📊 Analytics', show: (analytics?.completedCount || 0) > 0 },
                        { key: 'all', label: `👥 All Students (${(analytics?.totalStudents || 0)})`, show: true },
                        { key: 'completed', label: `✅ Completed (${completed.length})`, show: true },
                        { key: 'inProgress', label: `⏳ In Progress (${inProgress.length})`, show: true },
                        { key: 'notStarted', label: `❌ Not Started (${notStarted.length})`, show: true }
                    ].filter(t => t.show).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.key
                                ? 'bg-slate-700 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading...</div>
                ) : (
                    <>
                        {/* Analytics Tab */}
                        {activeTab === 'analytics' && analytics && (
                            <div className="space-y-6">
                                {/* Performance Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-1">Average Score</div>
                                        <div className="text-xl font-bold text-white">{analytics.averageScore ?? '-'}<span className="text-slate-500 text-sm">/{testInfo?.totalMarks}</span></div>
                                        <div className="text-xs text-slate-400">{analytics.averagePercentage ?? 0}% avg</div>
                                    </div>
                                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-1">Highest Score</div>
                                        <div className="text-xl font-bold text-emerald-400">{analytics.highestScore ?? '-'}<span className="text-slate-500 text-sm">/{testInfo?.totalMarks}</span></div>
                                    </div>
                                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-1">Lowest Score</div>
                                        <div className="text-xl font-bold text-red-400">{analytics.lowestScore ?? '-'}<span className="text-slate-500 text-sm">/{testInfo?.totalMarks}</span></div>
                                    </div>
                                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                                        <div className="text-xs text-slate-500 mb-1">Pass Rate</div>
                                        <div className="text-xl font-bold text-white">{analytics.passRate ?? 0}%</div>
                                        <div className="text-xs text-slate-400">{analytics.passedCount ?? 0} passed / {analytics.failedCount ?? 0} failed</div>
                                    </div>
                                </div>

                                {/* Score Distribution */}
                                {analytics.scoreDistribution && analytics.scoreDistribution.some(d => d.count > 0) && (
                                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-400" /> Score Distribution (%)</h3>
                                            <div className="text-xs text-slate-500 flex items-center gap-3">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/80"></span> 0-39% (Fail)</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/80"></span> 40-69% (Avg)</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/80"></span> 70-100% (Top)</span>
                                            </div>
                                        </div>

                                        <div className="relative h-48 mt-4 flex items-end gap-2 border-l border-b border-white/10 pb-2 pl-2">
                                            {/* Y-axis guidelines */}
                                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pl-2">
                                                <div className="border-b border-white/5 w-full"></div>
                                                <div className="border-b border-white/5 w-full"></div>
                                                <div className="border-b border-white/5 w-full"></div>
                                                <div className="border-b border-white/5 w-full"></div>
                                            </div>

                                            {analytics.scoreDistribution.map((bucket, i) => {
                                                const heightPerc = Math.max((bucket.count / maxDistCount) * 100, bucket.count > 0 ? 4 : 0);
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative z-10 h-full justify-end">
                                                        {bucket.count > 0 && (
                                                            <span className="text-xs text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-800 px-2.5 py-1 rounded shadow-xl border border-white/10 z-20 whitespace-nowrap">
                                                                {bucket.count} Student{bucket.count !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        <div
                                                            className={`w-full max-w-[40px] rounded-t-lg transition-all relative overflow-hidden shadow-sm ${bucket.count === 0 ? 'bg-transparent' :
                                                                i < 4 ? 'bg-red-500/80 hover:bg-red-400' :
                                                                    i < 7 ? 'bg-amber-500/80 hover:bg-amber-400' :
                                                                        'bg-emerald-500/80 hover:bg-emerald-400'
                                                                }`}
                                                            style={{ height: `${heightPerc}%` }}
                                                        >
                                                            {bucket.count > 0 && <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium absolute -bottom-6 turn-slightly">{`${i === 10 ? '100' : i * 10 + '-' + (i * 10 + 9)}`}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-6 text-center text-xs text-slate-500">Percentage Ranges</div>
                                    </div>
                                )}

                                {/* Batch Performance + Question Analysis */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Student Leaderboard */}
                                    {completed.length > 0 && (
                                        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 max-h-[28rem] overflow-y-auto custom-scrollbar">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Trophy className="h-4 w-4 text-amber-400" /> Student Leaderboard</h3>
                                            <div className="space-y-3">
                                                {[...completed].sort((a, b) => b.score - a.score).map((s, idx) => (
                                                    <div key={s.phone} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5 hover:bg-slate-800 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' : idx === 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-700/50 text-slate-400'}`}>
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[200px]">{s.name}</div>
                                                                <div className="text-[10px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(s.timeSpent)}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-base font-black text-emerald-400 whitespace-nowrap">{s.score} <span className="text-[10px] text-slate-500 font-normal">/ {testInfo?.totalMarks}</span></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Question Difficulty */}
                                    {analytics.questionAnalysis && analytics.questionAnalysis.length > 0 && (
                                        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 max-h-[28rem] overflow-y-auto custom-scrollbar flex flex-col">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Target className="h-4 w-4 text-orange-400" /> Question Difficulty</h3>

                                            <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                                <p className="text-xs text-blue-200 leading-relaxed">
                                                    <strong className="text-blue-400">Note:</strong> A lower accuracy percentage indicates the question was generally harder.
                                                </p>
                                            </div>

                                            <div className="space-y-2 flex-1">
                                                {analytics.questionAnalysis.map((q, i) => (
                                                    <div key={q.questionId} className="flex items-center gap-3 text-xs">
                                                        <span className="w-6 text-slate-500 font-bold text-right shrink-0">Q{i + 1}</span>
                                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
                                                            <div className={`h-full rounded-full ${q.accuracy >= 70 ? 'bg-emerald-500' : q.accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                                                }`} style={{ width: `${q.accuracy}%` }}></div>
                                                        </div>
                                                        <span className={`w-10 text-right font-bold shrink-0 ${q.accuracy >= 70 ? 'text-emerald-400' : q.accuracy >= 40 ? 'text-amber-400' : 'text-red-400'
                                                            }`}>{q.accuracy}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-[10px] text-slate-500 shrink-0">
                                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Easy (≥70%)</span>
                                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Medium (40-69%)</span>
                                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Hard (&lt;40%)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* All Students Tab */}
                        {activeTab === 'all' && (
                            <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left text-xs text-slate-400 border-b border-white/10 bg-slate-800/30">
                                                <th className="px-4 py-3 font-semibold">#</th>
                                                <th className="px-4 py-3 font-semibold">Student</th>
                                                <th className="px-4 py-3 font-semibold">Batch</th>
                                                <th className="px-4 py-3 font-semibold">Status</th>
                                                <th className="px-4 py-3 font-semibold text-red-400">Switches</th>
                                                <th className="px-4 py-3 font-semibold text-orange-400">Screenshots</th>
                                                <th className="px-4 py-3 font-semibold">Time Taken</th>
                                                <th className="px-4 py-3 font-semibold">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ...completed.map(s => ({ ...s, _status: 'completed' as const, status: s.status })),
                                                ...inProgress.map(s => ({ ...s, _status: 'inProgress' as const })),
                                                ...notStarted.map(s => ({ ...s, _status: 'notStarted' as const }))
                                            ].map((s, i) => (
                                                <tr key={s.phone || i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 text-slate-500 text-sm">{i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-white font-medium text-sm">{s.name}</div>
                                                        <div className="text-[10px] text-slate-500">{s.phone}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300 text-sm">{s.batch}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s._status === 'completed' ? (
                                                            s.terminationReason ? (
                                                                (s.terminationReason === 'time_limit' || s.terminationReason === 'server_auto_expired')
                                                                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                                                                    : 'bg-red-500/15 text-red-400 border border-red-500/20'
                                                            ) : 'bg-emerald-500/15 text-emerald-300'
                                                        ) :
                                                            s._status === 'inProgress' ? 'bg-blue-500/15 text-blue-300' :
                                                                'bg-red-500/15 text-red-300'
                                                            }`}>
                                                            {s._status === 'completed' ? (
                                                                s.terminationReason ? (
                                                                    (s.terminationReason === 'time_limit' || s.terminationReason === 'server_auto_expired')
                                                                        ? 'Time Up' : 'Terminated'
                                                                ) : 'Completed'
                                                            ) : s._status === 'inProgress' ? 'In Progress' : 'Not Started'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-sm font-bold ${s.windowSwitchCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                        {s.windowSwitchCount || 0}
                                                    </td>
                                                    <td className={`px-4 py-3 text-sm font-bold ${s.screenshotCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                                                        {s.screenshotCount || 0}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {s.violations && s.violations.length > 0 ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-red-400 text-xs font-bold font-mono">⚠️ {s.violations.length} Violation(s)</span>
                                                                <span className="text-[9px] text-slate-500 truncate max-w-[150px]">{s.violations[s.violations.length-1].details}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-emerald-500/40 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {s._status === 'completed' ? (
                                                            <span className="text-white font-bold">{s.score}<span className="text-slate-500 font-normal">/{testInfo?.totalMarks}</span></span>
                                                        ) : (
                                                            <span className="text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Completed Leaderboard (with reassign) */}
                        {activeTab === 'completed' && (
                            <div className="space-y-4">
                                {/* Bulk Reassign Toolbar */}
                                {completed.length > 0 && (
                                    <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="select-all"
                                                checked={selectedPhones.size === completed.length && completed.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded border-white/20 bg-black/40 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer accent-amber-500"
                                            />
                                            <label htmlFor="select-all" className="text-sm text-slate-400 cursor-pointer select-none">
                                                {selectedPhones.size > 0 ? `${selectedPhones.size} selected` : 'Select all'}
                                            </label>
                                        </div>
                                        {selectedPhones.size > 0 && (
                                            <button
                                                onClick={() => setShowReassignModal(true)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 text-sm font-bold transition-all"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Reassign Selected ({selectedPhones.size})
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                                    {completed.length === 0 ? (
                                        <p className="text-center py-12 text-slate-400">No completed attempts yet</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-left text-xs text-slate-400 border-b border-white/10 bg-slate-800/30">
                                                        <th className="px-4 py-3 font-semibold w-10">
                                                            {/* checkbox header placeholder */}
                                                        </th>
                                                        <th className="px-4 py-3 font-semibold">Rank</th>
                                                        <th className="px-4 py-3 font-semibold">Student</th>
                                                        <th className="px-4 py-3 font-semibold">Batch</th>
                                                        <th className="px-4 py-3 font-semibold">Score</th>
                                                        <th className="px-4 py-3 font-semibold">%</th>
                                                        <th className="px-4 py-3 font-semibold text-red-400">Switches</th>
                                                        <th className="px-4 py-3 font-semibold text-orange-400">Screenshots</th>
                                                        <th className="px-4 py-3 font-semibold">Time</th>
                                                        <th className="px-4 py-3 font-semibold">Submitted</th>
                                                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {completed.map((student, i) => (
                                                        <tr
                                                            key={student.phone}
                                                            className={`border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer ${selectedPhones.has(student.phone) ? 'bg-amber-500/5' : ''}`}
                                                            onClick={() => setReviewStudentPhone(student.phone)}
                                                        >
                                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedPhones.has(student.phone)}
                                                                    onChange={() => toggleSelectPhone(student.phone)}
                                                                    className="w-4 h-4 rounded border-white/20 bg-black/40 cursor-pointer accent-amber-500"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {i < 3 ? (
                                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${i === 0 ? 'bg-amber-500/20 text-amber-400' :
                                                                        i === 1 ? 'bg-slate-400/20 text-slate-300' :
                                                                            'bg-orange-500/20 text-orange-400'
                                                                        }`}>{i + 1}</span>
                                                                ) : (
                                                                    <span className="text-slate-500 font-medium text-sm pl-2">#{i + 1}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="text-white font-medium text-sm">{student.name}</div>
                                                                <div className="text-[10px] text-slate-500">{student.phone}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-300 text-sm">{student.batch}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-white font-bold text-sm">{student.score}</span>
                                                                <span className="text-slate-500 text-xs">/{testInfo?.totalMarks}</span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`font-bold text-sm ${student.percentage >= (testInfo?.passingPercentage || 40) ? 'text-emerald-400' : 'text-red-400'
                                                                    }`}>{student.percentage}%</span>
                                                                {student.terminationReason && (
                                                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border ${['time_limit', 'server_auto_expired'].includes(student.terminationReason)
                                                                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                                                                        }`}>
                                                                        {['time_limit', 'server_auto_expired'].includes(student.terminationReason) ? 'Time Up' : 'Terminated'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className={`px-4 py-3 text-sm font-bold ${student.windowSwitchCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                                {student.windowSwitchCount || 0}
                                                            </td>
                                                            <td className={`px-4 py-3 text-sm font-bold ${student.screenshotCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                                                                {student.screenshotCount || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-300 text-sm">{formatTime(student.timeSpent)}</td>
                                                            <td className="px-4 py-3 text-slate-400 text-xs">
                                                                {new Date(student.submittedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setReviewStudentPhone(student.phone);
                                                                    }}
                                                                    className="p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors"
                                                                    title="Review Submission & Give Adjustments"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* In Progress */}
                        {activeTab === 'inProgress' && (
                            <div className="space-y-4">
                                {/* Force Complete Toolbar */}
                                {inProgress.length > 0 && (
                                    <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3">
                                        <div>
                                            <span className="text-sm text-slate-400">
                                                {inProgress.length} student{inProgress.length !== 1 ? 's' : ''} still in progress
                                            </span>
                                            {testInfo?.endTime && new Date(testInfo.endTime) < new Date() && (
                                                <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                                                    PAST DEADLINE
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleForceComplete}
                                            disabled={forceCompleting}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-bold transition-all disabled:opacity-50"
                                        >
                                            {forceCompleting ? (
                                                <><RefreshCw className="w-4 h-4 animate-spin" /> Completing...</>
                                            ) : (
                                                <><XCircle className="w-4 h-4" /> Force Complete Expired</>
                                            )}
                                        </button>
                                    </div>
                                )}

                                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                                    {inProgress.length === 0 ? (
                                        <p className="text-center py-12 text-slate-400">No students currently taking the test</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-left text-xs text-slate-400 border-b border-white/10 bg-slate-800/30">
                                                        <th className="px-4 py-3 font-semibold">Student</th>
                                                        <th className="px-4 py-3 font-semibold">Batch</th>
                                                        <th className="px-4 py-3 font-semibold">Started</th>
                                                        <th className="px-4 py-3 font-semibold text-red-400">Switches</th>
                                                        <th className="px-4 py-3 font-semibold text-orange-400">Screenshots</th>
                                                        <th className="px-4 py-3 font-semibold">Elapsed</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inProgress.map(s => {
                                                        const isOvertime = testInfo?.endTime && new Date(testInfo.endTime) < new Date();
                                                        return (
                                                            <tr key={s.phone} className={`border-b border-white/5 hover:bg-white/5 ${isOvertime ? 'bg-red-500/5' : ''}`}>
                                                                <td className="px-4 py-3">
                                                                    <div className="text-white font-medium text-sm">{s.name}</div>
                                                                    <div className="text-[10px] text-slate-500">{s.phone}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-300 text-sm">{s.batch}</td>
                                                                <td className="px-4 py-3 text-slate-400 text-xs">
                                                                    {new Date(s.startedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                                                                </td>
                                                                <td className={`px-4 py-3 text-sm font-bold ${s.windowSwitchCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                                    {s.windowSwitchCount || 0}
                                                                </td>
                                                                <td className={`px-4 py-3 text-sm font-bold ${s.screenshotCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                                                                    {s.screenshotCount || 0}
                                                                </td>
                                                                <td className={`px-4 py-3 font-medium text-sm ${isOvertime ? 'text-red-400' : 'text-blue-400'}`}>
                                                                    {formatTime(s.timeElapsed)}
                                                                    {isOvertime && <span className="ml-1 text-[10px] text-red-500">⚠</span>}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Not Started */}
                        {activeTab === 'notStarted' && (
                            <div className="space-y-4">
                                {/* Reassign Missed Students Button */}
                                {notStarted.length > 0 && (
                                    <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3">
                                        <span className="text-sm text-slate-400">{notStarted.length} student{notStarted.length !== 1 ? 's' : ''} missed this test</span>
                                        <button
                                            onClick={() => {
                                                setNewStartTime('');
                                                setNewEndTime('');
                                                setShowMissedModal(true);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm font-bold transition-all"
                                        >
                                            <CalendarClock className="w-4 h-4" />
                                            Reassign Missed Students
                                        </button>
                                    </div>
                                )}

                                <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
                                    {notStarted.length === 0 ? (
                                        <p className="text-center py-12 text-emerald-400 font-medium">All students have started the test! 🎉</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-left text-xs text-slate-400 border-b border-white/10 bg-slate-800/30">
                                                        <th className="px-4 py-3 font-semibold">Student</th>
                                                        <th className="px-4 py-3 font-semibold">Batch</th>
                                                        <th className="px-4 py-3 font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {notStarted.map(s => (
                                                        <tr key={s.phone} className="border-b border-white/5 hover:bg-white/5">
                                                            <td className="px-4 py-3">
                                                                <div className="text-white font-medium text-sm">{s.name}</div>
                                                                <div className="text-[10px] text-slate-500">{s.phone}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-300 text-sm">{s.batch}</td>
                                                            <td className="px-4 py-3 flex items-center gap-4">
                                                                <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 text-xs font-medium">Not Attempted</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const deadline = testInfo?.endTime ? new Date(testInfo.endTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : 'soon';
                                                                        const text = `${s.phone}\n${s.name.split(' ')[0]} you have not yet started your scheduled online test and the deadline for starting is ${deadline}. Make sure you complete it within time.`;
                                                                        navigator.clipboard.writeText(text);
                                                                        toast.success('Reminder copied!');
                                                                    }}
                                                                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                                                    title="Copy Reminder"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
