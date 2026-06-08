'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trophy, Clock, Target, CheckCircle, XCircle, Minus, Award, TrendingUp, BarChart3 } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface QuestionReview {
    questionId: string;
    text: string;
    image?: string;
    latexContent?: boolean;
    type: string;
    marks: number;
    negativeMarks?: number;
    studentAnswer: any;
    isCorrect: boolean;
    marksAwarded: number;
    topic?: string;
    options?: string[];
    correctIndices?: number[];
    correctAnswer?: string;
    isNumberRange?: boolean;
    numberRangeMin?: number;
    numberRangeMax?: number;
    comprehensionText?: string;
    solutionText?: string;
    solutionImage?: string;
    isGraceAwarded?: boolean;
}

interface TopicAnalysis {
    topic: string;
    correct: number;
    total: number;
    marks: number;
    maxMarks: number;
    percentage: number;
}

export default function TestResultPage() {
    const router = useRouter();
    const params = useParams();
    const testId = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [testInfo, setTestInfo] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [questionReview, setQuestionReview] = useState<QuestionReview[]>([]);
    const [topicAnalysis, setTopicAnalysis] = useState<TopicAnalysis[]>([]);
    const [showQuestions, setShowQuestions] = useState(false);

    useEffect(() => {
        fetchResult();
    }, [testId]);

    const fetchResult = async () => {
        try {
            const res = await fetch(`/api/student/online-test/${testId}/result`, { cache: 'no-store' });
            const data = await res.json();

            // Handle results-pending/hidden (API returns 200 with these flags)
            if (data.resultsHidden || data.resultsPending) {
                setTestInfo({ title: 'Test Results' });
                setResult({
                    score: null,
                    percentage: null,
                    totalMarks: data.totalMarks,
                    resultsHidden: true,
                    resultsPending: data.resultsPending,
                    message: data.message
                });
                setLoading(false);
                return;
            }

            if (!res.ok) {
                if (res.status === 401) { router.push('/student/login'); return; }
                setError(data.error || 'Failed to load results');
                setLoading(false);
                return;
            }

            setTestInfo(data.test);
            setResult(data.result);
            setQuestionReview(data.questionReview || []);
            setTopicAnalysis(data.topicAnalysis || []);
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    // ... helper functions ...

    if (loading) {
        // ... loading state ...
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading results...</p>
                </div>
            </div>
        );
    }

    if (error) {
        // ... error state ...
        return (
            <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={() => router.push('/student/online-test')} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">
                        Back to Tests
                    </button>
                </div>
            </div>
        );
    }

    // PENDING RESULTS VIEW
    if (result?.resultsPending) {
        return (
            <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-[#0c1220]/90 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                    <div className="inline-flex p-4 rounded-full bg-emerald-500/10 mb-6 ring-4 ring-emerald-500/5">
                        <CheckCircle className="h-12 w-12 text-emerald-400" />
                    </div>

                    <h1 className="text-2xl font-black text-white mb-2">Test Submitted!</h1>
                    <p className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-6">Submission Successful</p>

                    <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5 mb-8">
                        <Clock className="h-6 w-6 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {result.message || "Results will be declared after the deadline."}
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/student/online-test')}
                        className="w-full px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-white/5 hover:border-white/10"
                    >
                        Back to Tests
                    </button>
                </div>
            </div>
        );
    }

    const hasLeaderboard = !result?.resultsHidden && result?.leaderboard && result.leaderboard.length > 0;

    return (
        <div className="min-h-screen bg-[#050b14] font-sans text-slate-200 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/8 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/8 blur-[120px]"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#050b14]/70 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <button onClick={() => router.push('/student/online-test')} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <h1 className="text-xs font-bold text-white">Test <span className="text-emerald-400">Results</span></h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 relative z-10 space-y-6">

                {/* Main Grid: Results Card vs Leaderboard */}
                <div className={`grid gap-6 ${hasLeaderboard ? 'lg:grid-cols-[1.5fr,1fr]' : 'max-w-3xl mx-auto'}`}>

                    {/* LEFT COLUMN: Stats & Rank Card */}
                    <div className="bg-[#0c1220]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col h-full">
                        {/* Background glow effects */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 opacity-50" />

                        <div className="grid md:grid-cols-2 gap-8 items-center h-full relative z-10 flex-1">
                            {/* LEFT HALF: Score & Rank */}
                            <div className="flex flex-col items-center justify-center space-y-6 border-b md:border-b-0 md:border-r border-white/5 pb-6 md:pb-0 md:pr-8">
                                {result?.resultsHidden ? (
                                    <div className="flex flex-col items-center justify-center text-center p-8">
                                        <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-white/5">
                                            <Clock className="w-10 h-10 text-slate-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Results Hidden</h3>
                                        <p className="text-sm text-slate-400 max-w-[200px]">
                                            Scores and analysis are currently hidden for this test.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Score Circle */}
                                        <div className="relative group">
                                            <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                                            <div className="relative w-40 h-40">
                                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                                                    <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="6" fill="none" className="text-slate-800" />
                                                    <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="6" fill="none"
                                                        strokeDasharray={`${(result?.percentage || 0) * 3.267} 326.7`}
                                                        strokeLinecap="round"
                                                        className={result?.passed ? 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]'}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className={`text-3xl font-black tracking-tight ${result?.passed ? 'text-white' : 'text-red-100'}`}>
                                                        {result?.percentage}%
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Your Score</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pass Badge */}
                                        <div className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg ${result?.passed ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                                            }`}>
                                            {result?.passed ? 'Passed' : 'Failed'}
                                        </div>

                                        {/* Global Rank */}
                                        {result?.rank && (
                                            <div className="text-center w-full pt-2">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Global Class Rank</div>
                                                <div className="relative inline-block">
                                                    {/* Rank Glow Effect */}
                                                    <div className="absolute -inset-4 bg-amber-500/20 blur-xl rounded-full opacity-50 animate-pulse"></div>
                                                    <div className="relative flex items-baseline justify-center gap-1.5">
                                                        <span className="text-xl sm:text-5xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">#{result.rank}</span>
                                                        <span className="text-xs sm:text-xl text-slate-600 font-bold">/ {result.totalStudents}</span>
                                                    </div>
                                                </div>

                                                {result.rank <= 3 && (
                                                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                                        <Trophy className="h-3.5 w-3.5" />
                                                        {result.rank === 1 ? 'Top of the Class!' : 'Podium Finish!'}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* RIGHT HALF: Stats (Stacked) - Time Taken Removed */}
                            <div className="flex flex-col gap-3 justify-center">
                                {/* Correct */}
                                <div className="bg-slate-900/40 hover:bg-slate-900/60 transition-colors rounded-xl p-4 flex items-center gap-4 border border-white/5 group">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                                        <CheckCircle className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-lg sm:text-2xl font-bold text-white leading-none mb-1">{result?.correctCount || 0}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Correct Answers</div>
                                    </div>
                                </div>

                                {/* Skipped (Placed 2nd to match typical flow, or User order: Correct, Skipped, Incorrect) */}
                                <div className="bg-slate-900/40 hover:bg-slate-900/60 transition-colors rounded-xl p-4 flex items-center gap-4 border border-white/5 group">
                                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400 border border-slate-500/20 group-hover:scale-110 transition-transform duration-300">
                                        <Minus className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-lg sm:text-2xl font-bold text-white leading-none mb-1">{result?.unansweredCount || 0}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Skipped Questions</div>
                                    </div>
                                </div>

                                {/* Incorrect */}
                                <div className="bg-slate-900/40 hover:bg-slate-900/60 transition-colors rounded-xl p-4 flex items-center gap-4 border border-white/5 group">
                                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]">
                                        <XCircle className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-lg sm:text-2xl font-bold text-white leading-none mb-1">{result?.incorrectCount || 0}</div>
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Incorrect Answers</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {result?.resultsHidden && (
                            <div className="absolute bottom-0 left-0 w-full bg-slate-900/80 p-3 text-center text-xs text-slate-400 border-t border-white/5 backdrop-blur-sm">
                                Detailed solutions and leaderboards are hidden for this test.
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Leaderboard */}
                    {hasLeaderboard && (
                        <div className="bg-[#0c1220]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col h-full max-h-[600px]">
                            <div className="flex items-center gap-3 mb-4 shrink-0">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <Trophy className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Test Leaderboard</h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Top 10 Performers</p>
                                </div>
                            </div>

                            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 -mr-2">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="text-[9px] text-slate-500 uppercase bg-slate-900/60 border-b border-white/5 sticky top-0 backdrop-blur-md z-10">
                                        <tr>
                                            <th className="px-3 py-2 font-bold">Rank</th>
                                            <th className="px-3 py-2 font-bold">Student</th>
                                            <th className="px-3 py-2 font-bold text-right">Score</th>
                                            <th className="px-3 py-2 font-bold text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {result.leaderboard.map((entry: any) => (
                                            <tr key={entry.rank} className={`hover:bg-white/5 transition-colors ${entry.isCurrentUser ? 'bg-blue-500/10' : ''}`}>
                                                <td className="px-3 py-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${entry.rank === 1 ? 'bg-amber-400 text-amber-950 shadow-amber-900/20' :
                                                        entry.rank === 2 ? 'bg-slate-300 text-slate-900 shadow-slate-900/20' :
                                                            entry.rank === 3 ? 'bg-orange-400 text-orange-950 shadow-orange-900/20' :
                                                                'text-slate-400 bg-slate-800 border border-white/5'
                                                        }`}>
                                                        {entry.rank}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`font-bold text-xs block truncate max-w-[120px] ${entry.isCurrentUser ? 'text-blue-400' : 'text-slate-300'}`}>
                                                        {entry.name} {entry.isCurrentUser && '(You)'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-white text-xs">{entry.score}</span>
                                                        <span className="text-[9px] text-slate-500 font-bold">{entry.percentage}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                                                        {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString('en-IN', {
                                                            day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'
                                                        }) : '-'}
                                                    </div>
                                                    <div className="text-[8px] text-slate-500 font-medium whitespace-nowrap">
                                                        {entry.submittedAt ? new Date(entry.submittedAt).toLocaleTimeString('en-IN', {
                                                            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
                                                        }) : ''}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Question Link Toggle */}
                {questionReview.length > 0 && !result?.resultsHidden && (
                    <div className="pt-4">
                        <button
                            onClick={() => setShowQuestions(!showQuestions)}
                            className="w-full group flex items-center justify-between px-6 py-5 bg-[#0c1220]/80 border border-white/10 rounded-2xl hover:border-emerald-500/30 transition-all hover:shadow-lg hover:shadow-emerald-900/10"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-slate-800 text-emerald-400 group-hover:bg-emerald-500/10 transition-colors border border-white/5">
                                    <Target className="h-6 w-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">Review Questions</div>
                                    <div className="text-xs text-slate-500">Analyze your mistakes question by question</div>
                                </div>
                            </div>
                            <div className="text-xs font-bold text-slate-400 bg-slate-900/50 px-4 py-2 rounded-xl border border-white/5 group-hover:border-emerald-500/20 group-hover:text-emerald-400 transition-all">
                                {showQuestions ? 'Hide Review ▲' : 'Show Review ▼'}
                            </div>
                        </button>

                        {showQuestions && (
                            <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 grid gap-6">
                                {questionReview.map((q, i) => (
                                    <div key={q.questionId} className={`rounded-3xl p-6 border transition-all ${q.isCorrect ? 'bg-emerald-900/5 border-emerald-500/20 shadow-lg shadow-emerald-900/5' :
                                        q.marksAwarded < 0 ? 'bg-red-900/5 border-red-500/20 shadow-lg shadow-red-900/5' :
                                            'bg-slate-900/40 border-slate-700/30'
                                        }`}>
                                        {/* Question header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/5">
                                            <div className="flex items-center justify-between sm:justify-start gap-4">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold border border-white/5">Q{i + 1}</span>
                                                    <div className="flex items-center gap-2">
                                                        {q.isCorrect ? <CheckCircle className="h-5 w-5 text-emerald-500" /> :
                                                            q.marksAwarded < 0 ? <XCircle className="h-5 w-5 text-red-500" /> :
                                                                <Minus className="h-5 w-5 text-slate-500" />}
                                                        <span className={`text-xs font-bold uppercase tracking-wide ${q.isCorrect ? 'text-emerald-500' :
                                                            q.marksAwarded < 0 ? 'text-red-500' : 'text-slate-500'
                                                            }`}>
                                                            {q.isCorrect ? 'Correct' : q.marksAwarded < 0 ? 'Incorrect' : 'Skipped'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Mobile marks (hidden on sm+) */}
                                                <span className={`sm:hidden text-base font-bold ${q.marksAwarded > 0 ? 'text-emerald-400' : q.marksAwarded < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                    {q.marksAwarded > 0 ? '+' : ''}{q.marksAwarded} <span className="text-slate-600 font-normal">/ {q.marks}</span>
                                                </span>
                                            </div>
                                            {/* Desktop marks (hidden on <sm) */}
                                            <span className={`hidden sm:block text-sm font-bold ${q.marksAwarded > 0 ? 'text-emerald-400' : q.marksAwarded < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                {q.marksAwarded > 0 ? '+' : ''}{q.marksAwarded} <span className="text-slate-600 font-normal">/ {q.marks}</span>
                                            </span>
                                        </div>

                                        {/* Question text */}
                                        <div className="text-xs sm:text-sm text-slate-200 mb-5 prose prose-invert max-w-none leading-relaxed">
                                            {q.latexContent ? <Latex>{q.text}</Latex> : q.text}
                                        </div>
                                        {q.image && (
                                            <div className="mb-6 bg-black/40 rounded-xl p-3 inline-block border border-white/10">
                                                <img src={q.image} alt="Question" className="max-w-full max-h-80 rounded-lg" />
                                            </div>
                                        )}

                                        {/* MCQ/MSQ Options */}
                                        {(q.type === 'mcq' || q.type === 'msq') && q.options && (
                                            <div className="grid gap-3 mb-5">
                                                {q.options.map((opt, oi) => {
                                                    const isCorrectOption = q.correctIndices?.includes(oi);
                                                    const isStudentChoice = q.type === 'mcq' ? q.studentAnswer === oi : Array.isArray(q.studentAnswer) && q.studentAnswer.includes(oi);
                                                    return (
                                                        <div key={oi} className={`flex items-start gap-4 px-5 py-4 rounded-xl text-sm transition-all ${isCorrectOption && isStudentChoice ? 'bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' :
                                                            isCorrectOption ? 'bg-emerald-500/10 border border-emerald-500/20 border-dashed' :
                                                                isStudentChoice ? 'bg-red-500/15 border border-red-500/30' :
                                                                    'bg-slate-800/30 border border-transparent'
                                                            }`}>
                                                            <div className="mt-0.5 shrink-0">
                                                                {isCorrectOption ? <CheckCircle className="h-5 w-5 text-emerald-400" /> :
                                                                    isStudentChoice ? <XCircle className="h-5 w-5 text-red-400" /> :
                                                                        <div className="w-5 h-5 rounded-full border border-slate-600/50" />}
                                                            </div>
                                                            <span className={`text-xs sm:text-sm leading-relaxed ${isCorrectOption ? 'text-white font-medium' : isStudentChoice ? 'text-red-200' : 'text-slate-400'}`}>{opt}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Fill blank answer */}
                                        {q.type === 'fillblank' && (
                                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 space-y-4">
                                                <div className="grid grid-cols-[120px,1fr] gap-4 items-center">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Your Answer</span>
                                                    <span className={`text-sm sm:text-base font-bold font-mono ${q.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {q.studentAnswer || '(empty)'}
                                                    </span>
                                                </div>
                                                {!q.isCorrect && (
                                                    <div className="grid grid-cols-[120px,1fr] gap-4 items-center pt-4 border-t border-white/5">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Correct</span>
                                                        <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                                                            {q.isNumberRange ? `${q.numberRangeMin} - ${q.numberRangeMax}` : q.correctAnswer}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Broad answer */}
                                        {q.type === 'broad' && (
                                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-widest">Your Answer</div>
                                                <div className="text-base text-slate-300 font-serif italic mb-4 leading-relaxed">"{q.studentAnswer || '(empty)'}"</div>
                                                <div className="inline-flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/10 font-bold">
                                                    Manually Graded Question
                                                </div>
                                            </div>
                                        )}

                                        {/* Grace Badge */}
                                        {q.isGraceAwarded && (
                                            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-bold">
                                                <Award className="h-4 w-4" />
                                                Grace Marks Awarded: Full marks given to all students.
                                            </div>
                                        )}

                                        {/* Solution & Explanation */}
                                        {(q.solutionText || q.solutionImage) && (
                                            <div className="mt-6 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                                                        <TrendingUp className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-bold text-emerald-400">Explanation</span>
                                                </div>

                                                {q.solutionText && (
                                                    <div className="text-sm text-slate-300 prose prose-invert max-w-none leading-relaxed mb-4">
                                                        <Latex>{q.solutionText}</Latex>
                                                    </div>
                                                )}

                                                {q.solutionImage && (
                                                    <div className="bg-black/40 rounded-xl p-3 inline-block border border-white/10">
                                                        <img src={q.solutionImage} alt="Solution info" className="max-w-full max-h-80 rounded-lg" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Back Button */}
                <div className="text-center pt-6 pb-12">
                    <button
                        onClick={() => router.push('/student/online-test')}
                        className="px-8 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all border border-transparent hover:border-white/10 flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to all tests
                    </button>
                </div>
            </main>
        </div>
    );
}
