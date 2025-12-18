'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Brain, User, BookOpen, Loader2, Lightbulb, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function PracticeQuestionsPage() {
    const [resource, setResource] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());

    // AI Verification State
    const [showAIModal, setShowAIModal] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

    // const [aiEnabledTopics, setAiEnabledTopics] = useState<Set<string>>(new Set()); // REMOVED: Now part of resource

    const router = useRouter();
    const params = useParams();
    const resourceId = params.id as string;

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        fetchResource();
    }, [router, resourceId]);

    const fetchResource = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/resources/${resourceId}`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setResource(data.resource);
                setQuestions(data.questions || []);
            } else {
                toast.error('Failed to load resource');
            }

            // Fetch AI Enabled Topics - REMOVED (Merged into Resource API)
            /* 
            try {
                const aiRes = await fetch('/api/student/ai-settings');
                if (aiRes.ok) {
                    const data = await aiRes.json();
                    setAiEnabledTopics(new Set(data.enabledTopics || []));
                }
            } catch (error) {
            }
            */
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const toggleHint = (questionId: string) => {
        setExpandedHints(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };

    const generateAIPrompt = (question: any) => {
        return `I need help verifying my answer to this question:

QUESTION:
${question.latex || question.text}

Please:
1. Ask me to upload an image/PDF of my solution if I haven't already
2. Check if my answer and process are correct
3. If there are errors, guide me briefly on what's wrong
4. If correct, congratulate me
5. Keep your response short and crisp - no extra sentences

Thank you!`;
    };

    const handleAIVerify = (question: any) => {
        setSelectedQuestion(question);
        setShowAIModal(true);
    };

    const openGemini = () => {
        if (!selectedQuestion) return;

        const prompt = generateAIPrompt(selectedQuestion);

        // Copy to clipboard
        navigator.clipboard.writeText(prompt).then(() => {
            toast.success('Prompt copied to clipboard!');
            // Open Gemini in new tab
            window.open('https://gemini.google.com', '_blank');
            setShowAIModal(false);
        }).catch(() => {
            toast.error('Failed to copy prompt');
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!resource) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Link href="/student/resources" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                        <ArrowLeft className="h-5 w-5" />
                        Back to Resources
                    </Link>
                    <div className="text-center py-20 text-gray-400">
                        Resource not found
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-gradient-radial from-purple-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-violet-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                {/* Header- Compact */}
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                    <Link href="/student/resources" className="p-2 sm:p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all shrink-0">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 line-clamp-1">
                            {resource.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-sm text-gray-400">
                            {resource.targetCourse && (
                                <span className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {resource.targetCourse}
                                </span>
                            )}
                            {resource.facultyName && (
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {resource.facultyName}
                                </span>
                            )}
                            {resource.topic && (
                                <span className="flex items-center gap-1 text-purple-400">
                                    <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {resource.topic}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary Card - Compact */}
                <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/30 mb-4 sm:mb-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-purple-500/20">
                            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-purple-300 font-bold text-sm sm:text-lg">
                                {questions.length} Practice Questions
                            </p>
                            <p className="text-purple-300/60 text-xs sm:text-sm">
                                {resource.hints && Object.keys(resource.hints).length > 0 && 'With hints available'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Questions List */}
                {questions.length === 0 ? (
                    <div className="text-center py-10 sm:py-16 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10">
                        <Brain className="h-10 w-10 sm:h-12 sm:w-12 text-purple-500/50 mx-auto mb-3 sm:mb-4" />
                        <p className="text-sm text-gray-500">No questions found</p>
                    </div>
                ) : (
                    <div className="space-y-3 sm:space-y-5">
                        {questions.map((question, index) => {
                            const questionHints = resource.hints?.[question._id] || [];
                            const hasHints = questionHints.length > 0;
                            const isExpanded = expandedHints.has(question._id);

                            return (
                                <div key={question._id} className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10 overflow-hidden hover:border-purple-500/30 transition-all">
                                    <div className="p-4 sm:p-6">
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                {/* AI Verify Button - Float on right so text flows around it */}
                                                {/* Check resource.aiEnabled instead of local set */}
                                                {resource.aiEnabled && (
                                                    <button
                                                        onClick={() => handleAIVerify(question)}
                                                        className="float-right ml-3 mb-2 flex-shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 text-[10px] sm:text-xs font-bold transition-all hover:shadow-lg hover:shadow-cyan-500/20 backdrop-blur-sm whitespace-nowrap"
                                                        title="Verify your answer with AI"
                                                    >
                                                        <span className="hidden sm:inline">AI Verify</span>
                                                        <span className="sm:hidden">AI Verify</span>
                                                    </button>
                                                )}

                                                <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                    {question.topic && (
                                                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-purple-500/20 text-purple-400">{question.topic}</span>
                                                    )}
                                                    {question.subtopic && (
                                                        <span className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-white/5 text-gray-400">{question.subtopic}</span>
                                                    )}
                                                    {question.type && (
                                                        <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg ${question.type === 'broad' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                            {question.type === 'broad' ? 'Broad' : 'Short'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs sm:text-base text-gray-200 leading-relaxed">
                                                    <Latex>{question.latex || question.text}</Latex>
                                                </div>
                                                {question.image && (
                                                    <div className="mt-3 sm:mt-4">
                                                        <img
                                                            src={question.image}
                                                            alt="Question Illustration"
                                                            className="max-w-full max-h-64 rounded-lg border border-white/10"
                                                        />
                                                    </div>
                                                )}
                                                <div className="clear-both"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hints Section */}
                                    {hasHints && (
                                        <>
                                            <button
                                                onClick={() => toggleHint(question._id)}
                                                className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-amber-900/20 border-t border-amber-500/20 flex items-center justify-between text-amber-400 hover:bg-amber-900/30 transition-colors"
                                            >
                                                <span className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                                                    <Lightbulb className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    {questionHints.length} Hint{questionHints.length > 1 ? 's' : ''} Available
                                                </span>
                                                {isExpanded ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                                            </button>

                                            {isExpanded && (
                                                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-amber-950/20 border-t border-amber-500/20 space-y-2 sm:space-y-3">
                                                    {questionHints.map((hint: string, hintIndex: number) => (
                                                        <div key={hintIndex} className="flex items-start gap-2 sm:gap-3">
                                                            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] sm:text-xs font-bold">
                                                                {hintIndex + 1}
                                                            </span>
                                                            <div className="text-amber-200/80 text-xs sm:text-sm">
                                                                <Latex>{hint}</Latex>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* AI Verification Modal */}
                {showAIModal && selectedQuestion && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-cyan-500/30 w-full max-w-lg shadow-2xl shadow-cyan-500/20 overflow-hidden max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 sm:p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-white">AI Answer Verification</h3>
                                            <p className="text-blue-100 text-xs sm:text-sm">Get instant feedback</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowAIModal(false)} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4 sm:p-5 space-y-3">
                                <p className="text-xs sm:text-sm text-cyan-400 font-semibold">How it works:</p>
                                <ol className="space-y-2 text-xs sm:text-sm text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] sm:text-xs">1</span>
                                        <span>We'll copy a custom prompt to your clipboard</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] sm:text-xs">2</span>
                                        <span>Gemini AI will open in a new tab</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] sm:text-xs">3</span>
                                        <span><strong className="text-white">Paste (Ctrl+V)</strong> the prompt in Gemini's chat</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] sm:text-xs">4</span>
                                        <span><strong className="text-white">Upload</strong> a photo/PDF of your handwritten solution</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-[10px] sm:text-xs">5</span>
                                        <span>Get instant feedback and guidance! 🎉</span>
                                    </li>
                                </ol>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 sm:p-3">
                                    <p className="text-[10px] sm:text-xs text-blue-300">💡 <strong>Tip:</strong> Make sure your solution is clearly written for best results</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 sm:p-5 flex gap-2 sm:gap-3">
                                <button onClick={() => setShowAIModal(false)} className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all text-sm">Cancel</button>
                                <button onClick={openGemini} className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 text-sm">
                                    <Sparkles className="h-4 w-4" />
                                    <span className="hidden xs:inline">Copy Question & Open Gemini</span>
                                    <span className="xs:hidden">Copy & Open</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
