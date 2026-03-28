'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Save, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LatexRender from '@/components/LatexRenderer';

export default function SubmissionReviewModal({
    testId,
    phone,
    userEmail,
    onClose,
    onSuccess
}: {
    testId: string;
    phone: string;
    userEmail: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<any>(null);
    const [adjustments, setAdjustments] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchSubmission = async () => {
            try {
                const res = await fetch(`/api/admin/online-test/${testId}/student/${phone}`, {
                    headers: { 'X-User-Email': userEmail }
                });
                if (res.ok) {
                    const json = await res.json();
                    setData(json);

                    // Initialize adjustments with existing values
                    const initialAdjustments: Record<string, number> = {};
                    if (json.attempt?.answers) {
                        json.attempt.answers.forEach((ans: any) => {
                            if (ans.adjustmentMarks) {
                                initialAdjustments[ans.questionId] = ans.adjustmentMarks;
                            }
                        });
                    }
                    setAdjustments(initialAdjustments);
                } else {
                    toast.error('Failed to load submission');
                    onClose();
                }
            } catch (error) {
                toast.error('Error loading submission');
                onClose();
            } finally {
                setLoading(false);
            }
        };
        fetchSubmission();
    }, [testId, phone, userEmail]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Convert adjustments to an array of { questionId, adjustmentMarks }
            const payload = Object.entries(adjustments).map(([questionId, adjustmentMarks]) => ({
                questionId,
                adjustmentMarks: Number(adjustmentMarks) || 0
            }));

            const res = await fetch(`/api/admin/online-test/${testId}/student/${phone}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail
                },
                body: JSON.stringify({ adjustments: payload })
            });

            if (res.ok) {
                toast.success('Adjustment marks saved successfully!');
                onSuccess();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to save adjustments');
            }
        } catch (error) {
            toast.error('Error saving adjustment marks');
        } finally {
            setSaving(false);
        }
    };

    const handleAdjustmentChange = (questionId: string, value: string) => {
        setAdjustments(prev => ({
            ...prev,
            [questionId]: value === '' ? 0 : Number(value)
        }));
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-white font-medium">Loading submission...</span>
                </div>
            </div>
        );
    }

    if (!data || !data.attempt || !data.attempt.questions) return null;

    const { student, attempt } = data;

    // Helper to get answer details for a specific question id
    const getAnswerDetails = (qId: string) => {
        return attempt.answers?.find((a: any) => a.questionId === qId) || null;
    };

    const renderQuestion = (q: any, index: number) => {
        const ans = getAnswerDetails(q.id);
        const adjustment = adjustments[q.id] || 0;
        const baseMarks = ans?.marksAwarded || 0;
        const totalMarks = baseMarks + adjustment;

        // timeTaken is stored in milliseconds
        const timeTakenMs = ans?.timeTaken || 0;
        const m = Math.floor(timeTakenMs / 60000);
        const s = Math.floor((timeTakenMs % 60000) / 1000);
        const timeTakenDesc = timeTakenMs > 0 ? (m > 0 ? `${m}m ${s}s` : `${s}s`) : '-';

        return (
            <div key={q.id} className="bg-slate-800/50 border border-white/5 rounded-xl p-5 mb-4">
                <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-slate-700 rounded-md text-xs font-bold text-white">Q{index + 1}</span>
                        <span className="text-xs font-semibold text-slate-400 capitalize">{q.type}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900/80 rounded-lg p-1.5 border border-white/10">
                        <div className="text-[10px] text-slate-400 flex flex-col items-center px-2 pr-3">
                            <span className="flex items-center gap-1 font-bold whitespace-nowrap"><Clock className="w-3 h-3" /> {timeTakenDesc}</span>
                            <span className="font-mono mt-0.5 whitespace-nowrap px-1 rounded bg-black/50 border border-white/10 text-slate-300">
                                [{q.marks ? `+${q.marks}` : '+1'}, {q.negativeMarks ? `-${q.negativeMarks}` : '0'}]
                            </span>
                        </div>
                        <div className="w-px h-8 bg-white/10 mx-0"></div>
                        <div className="text-xs text-slate-400 px-2 flex flex-col items-end">
                            <span className="mb-0.5">Earned: <span className={baseMarks > 0 ? 'text-emerald-400 font-bold' : baseMarks < 0 ? 'text-red-400 font-bold' : 'text-slate-300 font-bold'}>{baseMarks > 0 ? '+' : ''}{baseMarks}</span></span>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs font-bold text-amber-500 mr-1">Adj:</span>
                            <input
                                type="number"
                                step="any"
                                value={adjustments[q.id] === 0 && ans?.adjustmentMarks === 0 ? '' : adjustments[q.id]}
                                onChange={(e) => handleAdjustmentChange(q.id, e.target.value)}
                                placeholder="0"
                                className="w-16 bg-black/50 border border-amber-500/30 rounded px-2 py-1 text-sm text-center font-bold text-amber-400 placeholder:text-amber-500/30 focus:outline-none focus:ring-1 focus:ring-amber-500 hide-arrows"
                            />
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        <div className="px-2">
                            <span className="text-xs font-bold text-slate-400 mr-1">Total:</span>
                            <span className={`text-sm font-bold ${totalMarks > 0 ? 'text-emerald-400' : totalMarks < 0 ? 'text-red-400' : 'text-white'}`}>{totalMarks}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-4 text-white text-sm prose prose-invert max-w-none">
                    <LatexRender content={q.text} />
                    {q.imageUrl && <img src={q.imageUrl} alt="Question" className="mt-3 rounded-lg max-h-64 object-contain" />}
                </div>

                <div className="bg-black/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-slate-400 mb-2 font-semibold">Student's Answer:</div>
                        {!ans || ans.answer === undefined || ans.answer === null || ans.answer === '' ? (
                            <span className="text-slate-500 italic text-sm">Not answered</span>
                        ) : (
                            <div className="flex items-start gap-2">
                                {ans.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                                <div className="text-sm text-white break-words">
                                    {Array.isArray(ans.answer) ? ans.answer.join(', ') : String(ans.answer)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Simplified Correct Answer Display (could be expanded based on type) */}
                    <div>
                        <div className="text-xs text-slate-400 mb-2 font-semibold">Correct Answer (Info):</div>
                        <div className="text-sm text-emerald-400">
                            {q.type === 'mcq' || q.type === 'msq' ? `Option Indices: ${q.correctIndices?.join(', ')}` :
                                q.type === 'fillblank' ? (q.isNumberRange ? `Range: ${q.numberRangeMin} - ${q.numberRangeMax}` : `Text: ${q.fillBlankAnswer}`) :
                                    'Manual grading'}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 p-5 px-6 border-b border-white/5 flex items-center justify-between sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            {student.name}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 uppercase tracking-wide border border-amber-500/20">Review</span>
                        </h2>
                        <div className="text-sm text-slate-400 mt-1 flex items-center gap-3">
                            <span>📱 {student.phone}</span>
                            <span>📚 {student.batch}</span>
                            <span>🎯 Current Score: <strong className="text-white">{attempt.score}</strong></span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        disabled={saving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body / Questions List */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Alert */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-200">
                            Enter adjustment marks in the <strong>Adj</strong> fields for specific questions. This can be positive (+) or negative (-). The final score will recalculate and automatically update all analytics when saved.
                        </div>
                    </div>

                    {/* Proctoring Violations Log */}
                    {attempt.violations && attempt.violations.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8">
                            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-4 uppercase tracking-wider">
                                <AlertCircle className="w-4 h-4" /> Proctoring Violations Log
                            </h3>
                            <div className="space-y-3">
                                {attempt.violations.map((v: any, idx: number) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-red-950/20 rounded-lg border border-red-500/10">
                                        <div className="flex items-start gap-3">
                                            <div className="p-1.5 rounded-md bg-red-500/20 text-red-500 shrink-0 mt-0.5">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-red-200 capitalize">{v.type?.replace('_', ' ')}</div>
                                                <div className="text-xs text-red-400/80 mt-0.5">{v.details}</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-red-500/60 whitespace-nowrap bg-black/30 px-2 py-1 rounded border border-red-500/5">
                                            {new Date(v.timestamp).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Rendering all questions */}
                    {attempt.questions.map((q: any, i: number) => {
                        if (q.type === 'comprehension' && q.subQuestions) {
                            return (
                                <div key={q.id} className="mb-6 bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden">
                                    <div className="p-4 border-b border-white/5 bg-slate-900/80">
                                        <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Comprehension Passage</div>
                                        <div className="text-sm text-slate-300 prose prose-invert">
                                            <LatexRender content={q.text} />
                                            {q.imageUrl && <img src={q.imageUrl} alt="Passage" className="mt-2 rounded-lg max-h-48" />}
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        {q.subQuestions.map((sq: any, sqIdx: number) => renderQuestion(sq, i + sqIdx))}
                                    </div>
                                </div>
                            );
                        } else {
                            return renderQuestion(q, i);
                        }
                    })}
                </div>

                {/* Footer */}
                <div className="bg-slate-900 p-5 px-6 border-t border-white/5 flex items-center justify-between sticky bottom-0 z-10 shrink-0">
                    <div className="text-sm text-slate-400">
                        Total Adjustments:{' '}
                        <strong className="text-amber-400">
                            {Object.values(adjustments).reduce((acc: number, val: number) => acc + (val || 0), 0)}
                        </strong>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm font-bold transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center gap-2 transition-all"
                        >
                            {saving ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save Adjustments</>
                            )}
                        </button>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .hide-arrows::-webkit-outer-spin-button,
                    .hide-arrows::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                    .hide-arrows {
                        -moz-appearance: textfield;
                    }
                `}} />
            </div>
        </div>
    );
}
