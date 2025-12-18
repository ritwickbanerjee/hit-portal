'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

type Question = {
    _id: string;
    text: string;
    type: 'mcq' | 'blanks' | 'broad';
    topic: string;
    marks: number;
};

export default function MockTest() {
    const [student, setStudent] = useState<any>(null);
    const [step, setStep] = useState<'faculty' | 'topics' | 'test' | 'finished'>('faculty');
    const [faculties, setFaculties] = useState<string[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [topics, setTopics] = useState<string[]>([]);
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [totalMarks, setTotalMarks] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        fetchFaculties(parsedStudent);
    }, [router]);

    // Timer countdown
    useEffect(() => {
        if (step === 'test' && timeRemaining > 0) {
            const interval = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        finishTest();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [step, timeRemaining]);

    const fetchFaculties = async (studentData: any) => {
        try {
            const params = new URLSearchParams({
                course: studentData.course_code,
                department: studentData.department,
                year: studentData.year
            });
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/mock-test/faculties?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setFaculties(data);
            } else {
            }
        } catch (error) {
            toast.error('Failed to load faculties');
        }
    };

    const fetchTopics = async (facultyName: string) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/mock-test/topics?facultyName=${encodeURIComponent(facultyName)}&course=${encodeURIComponent(student.course_code)}&department=${encodeURIComponent(student.department)}&year=${encodeURIComponent(student.year)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setTopics(await res.json());
                setStep('topics');
            } else {
                toast.error('Failed to load topics');
            }
        } catch (error) {
            toast.error('Error loading topics');
        } finally {
            setLoading(false);
        }
    };

    const startTest = async () => {
        if (selectedTopics.length === 0) {
            toast.error('Please select at least one topic');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/student/mock-test/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ facultyName: selectedFaculty, topics: selectedTopics })
            });

            if (res.ok) {
                const data = await res.json();
                setQuestions(data.questions);
                setTotalMarks(data.totalMarks);
                setTimeRemaining(data.timeMinutes * 60);
                setStep('test');
                toast.success('Question paper generated!');
            } else {
                toast.error('Failed to generate test');
            }
        } catch (error) {
            toast.error('Error starting test');
        } finally {
            setLoading(false);
        }
    };

    const finishTest = () => {
        setStep('finished');
        setTimeout(() => {
            setQuestions([]);
            setSelectedTopics([]);
            setSelectedFaculty('');
            setStep('faculty');
        }, 3000);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getTimerColor = () => {
        if (timeRemaining > 300) return 'text-emerald-400';
        if (timeRemaining > 120) return 'text-amber-400';
        return 'text-rose-400';
    };

    if (!student) return null;

    // Test Interface - Question Paper View Only
    if (step === 'test' && questions.length > 0) {
        const currentQuestion = questions[currentQuestionIndex];
        const isLastQuestion = currentQuestionIndex === questions.length - 1;

        return (
            <div className="min-h-screen bg-[#0a0f1a]">
                {/* Sticky Header - Dark Theme */}
                <div className="sticky top-0 z-50 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-emerald-500/30 shadow-lg">
                    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                        <h1 className="text-center text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-1 sm:mb-2">
                            Heritage Institute of Technology
                        </h1>
                        <h2 className="text-center text-sm sm:text-base font-semibold text-gray-300 mb-2">
                            Mock Test
                        </h2>
                        <div className="flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-1 text-xs sm:text-sm text-gray-400 mb-2">
                            <span><strong className="text-blue-400">Course:</strong> {student.course_code}</span>
                            <span><strong className="text-purple-400">Dept:</strong> {student.department}</span>
                            <span><strong className="text-pink-400">Year:</strong> {student.year}</span>
                            <span className="hidden sm:inline"><strong className="text-amber-400">Topic(s):</strong> {selectedTopics.join(', ')}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
                            <span className={`flex items-center gap-1 sm:gap-2 ${getTimerColor()}`}>
                                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Timer:</span> {formatTime(timeRemaining)}
                            </span>
                            <span className="text-gray-300">
                                Q{currentQuestionIndex + 1}/{questions.length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Question Area - Dark Theme */}
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-lg shadow-2xl p-4 sm:p-6 border border-emerald-500/20">
                        <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                Question {currentQuestionIndex + 1}
                            </h3>
                            <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-2 sm:px-3 py-1 rounded-full">
                                {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                            </span>
                        </div>

                        <div className="text-gray-200 text-sm sm:text-base leading-relaxed">
                            <Latex>{currentQuestion.text}</Latex>
                        </div>
                        {currentQuestion.image && (
                            <div className="mt-4 flex justify-center">
                                <img
                                    src={currentQuestion.image}
                                    alt="Question Illustration"
                                    className="max-h-64 rounded-lg border border-emerald-500/20"
                                />
                            </div>
                        )}
                    </div>

                    {/* Navigation - Always show both buttons on last page */}
                    <div className="flex justify-between items-center mt-4 sm:mt-6 gap-2">
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestionIndex === 0}
                            className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gray-700 text-white rounded-lg text-sm sm:text-base font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="hidden sm:inline">Previous</span>
                            <span className="sm:hidden">Prev</span>
                        </button>

                        <div className="flex gap-2">
                            {/* Finish button - only visible on last page */}
                            {isLastQuestion && (
                                <button
                                    onClick={finishTest}
                                    className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg text-sm sm:text-base font-bold hover:from-emerald-700 hover:to-green-700 transition-colors shadow-lg"
                                >
                                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span>Finish</span>
                                </button>
                            )}

                            {/* Next button - always visible, disabled on last page */}
                            <button
                                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                disabled={isLastQuestion}
                                className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                            >
                                <span>Next</span>
                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Finished Screen
    if (step === 'finished') {
        return (
            <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
                <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">Session Complete!</h2>
                    <p className="text-gray-400">Redirecting...</p>
                </div>
            </div>
        );
    }

    // Faculty & Topic Selection
    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/student/resources" className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                        Mock Test
                    </h1>
                </div>

                {step === 'faculty' && (
                    <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4">Select Faculty</h2>
                        <p className="text-gray-400 mb-6">Choose the faculty whose question bank you want to use</p>

                        <select
                            value={selectedFaculty}
                            onChange={(e) => setSelectedFaculty(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-900 text-white border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none mb-4"
                        >
                            <option value="">-- Select Faculty --</option>
                            {faculties.map(faculty => (
                                <option key={faculty} value={faculty}>{faculty}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => selectedFaculty && fetchTopics(selectedFaculty)}
                            disabled={!selectedFaculty || loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Loading...' : 'Continue'}
                        </button>
                    </div>
                )}

                {step === 'topics' && (
                    <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                        <h2 className="text-xl font-bold text-white mb-4">Select Topics</h2>
                        <p className="text-gray-400 mb-6">Choose one or more topics for your question paper</p>

                        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                            {topics.map(topic => (
                                <label key={topic} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(topic)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedTopics(prev => [...prev, topic]);
                                            } else {
                                                setSelectedTopics(prev => prev.filter(t => t !== topic));
                                            }
                                        }}
                                        className="w-5 h-5"
                                    />
                                    <span className="text-white">{topic}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('faculty')}
                                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={startTest}
                                disabled={selectedTopics.length === 0 || loading}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Generating...' : 'Generate Paper'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
