'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, FileText, Calendar, Users, Clock, Trash2, Edit, Check, X, ArrowRight, ArrowLeft, Save } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function OnlineTestPage() {
    // State: 'dashboard' | 'selection' | 'editor' | 'deployment'
    const [view, setView] = useState('dashboard');
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);

    // Test Creation State
    const [currentTest, setCurrentTest] = useState<any>(null);

    // Question Selection State
    const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({ topic: '', subtopic: '', type: '' });

    // Derived Lists (matching QuestionBank logic)
    const topics = useMemo(() => Array.from(new Set(availableQuestions.map(q => q.topic).filter(Boolean))).sort(), [availableQuestions]);
    const subtopics = useMemo(() => Array.from(new Set(availableQuestions.map(q => q.subtopic).filter(Boolean))).sort(), [availableQuestions]);

    const [user, setUser] = useState<any>(null);
    const [config, setConfig] = useState<any>({ teacherAssignments: {} });

    // Mock Data for Dashboard (Replace with API fetch)
    useEffect(() => {
        const init = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }

            try {
                const headers = getHeaders();
                const cRes = await fetch('/api/admin/config', { headers });
                if (cRes.ok) {
                    const data = await cRes.json();
                    setConfig(data);
                }
            } catch (e) {
                console.error("Error fetching config", e);
            }

            fetchTests();
        };
        init();
    }, []);

    // Derived Lists for Deployment (Access Control)
    const { depts, years, courses } = useMemo(() => {
        const d = new Set<string>();
        const y = new Set<string>();
        const c = new Set<string>();

        const isGA = typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true';

        if (isGA) {
            // Global Admin sees all options (hardcoded for now as we don't have a student list here to derive from)
            // Or better, we can provide standard options
            ['CSE', 'ECE', 'ME', 'CE', 'EE'].forEach(dept => d.add(dept));
            ['1', '2', '3', '4'].forEach(year => y.add(year));
            // Courses might be tricky without a full list, but we can allow free text or fetch all courses
            // For GA, we might want to allow free text input or show all from config if available
        } else if (user?.email && config.teacherAssignments) {
            Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                if (Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === user.email.toLowerCase())) {
                    const parts = key.split('_');
                    if (parts.length >= 3) {
                        d.add(parts[0]);
                        y.add(parts[1]);
                        c.add(parts[2]);
                    }
                }
            });
        }

        return {
            depts: Array.from(d).sort(),
            years: Array.from(y).sort(),
            courses: Array.from(c).sort()
        };
    }, [config, user]);

    const getHeaders = () => {
        const headers: any = { 'Content-Type': 'application/json' };
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.email) headers['X-User-Email'] = user.email;
        }
        const ga = localStorage.getItem('globalAdminActive');
        if (ga === 'true') headers['X-Global-Admin-Key'] = 'globaladmin_25';
        return headers;
    };

    const fetchTests = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/online-test/list', {
                headers: getHeaders()
            });
            const data = await res.json();
            if (data.tests) {
                setTests(data.tests);
            }
        } catch (error) {
            console.error("Failed to fetch tests", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setCurrentTest({
            title: 'Untitled Test',
            questions: [],
            status: 'draft',
            createdAt: new Date()
        });
        setView('selection');
        fetchQuestions();
    };

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                headers: getHeaders()
            });
            const data = await res.json();

            // Handle both array and object response formats
            const questionsList = Array.isArray(data) ? data : (data.questions || []);

            if (questionsList.length > 0) {
                setAvailableQuestions(questionsList);
            }
        } catch (error) {
            console.error("Failed to fetch questions", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleQuestionSelection = (q: any) => {
        const newSet = new Set(selectedQuestionIds);
        if (newSet.has(q.id)) {
            newSet.delete(q.id);
        } else {
            newSet.add(q.id);
        }
        setSelectedQuestionIds(newSet);
    };

    const handleProceedToEditor = () => {
        // Filter selected questions and add to currentTest
        const selected = availableQuestions.filter(q => selectedQuestionIds.has(q.id));

        // Intelligent MCQ Parsing Logic
        const processedQuestions = selected.map(q => {
            let type = q.type || 'broad';
            let options: string[] = [];
            let text = q.text;

            // Simple regex to detect options like a) ... b) ...
            const optionRegex = /([a-dA-D])\)\s*(.*?)(?=(?:[a-dA-D]\))|$)/g;
            const matches = [...text.matchAll(optionRegex)];

            if (matches.length >= 2) {
                type = 'mcq';
                options = matches.map(m => m[2].trim());
                text = text.replace(optionRegex, '').trim();
            }

            // Auto-create 4 options for MCQ if missing
            if (type === 'mcq' && options.length === 0) {
                options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
            }

            // Calculate initial indices from values (best effort for existing data)
            let correctIndices: number[] = [];
            if (q.correctAnswers) {
                correctIndices = q.correctAnswers.map((ans: string) => options.indexOf(ans)).filter((idx: number) => idx !== -1);
            }

            return {
                ...q,
                type,
                options,
                marks: 1, // Default marks
                negativeMarks: 0,
                correctAnswers: q.correctAnswers || [],
                correctIndices // Internal tracking
            };
        });

        setCurrentTest({ ...currentTest, questions: processedQuestions });
        setView('editor');
    };

    const validateQuestions = () => {
        const questions = currentTest.questions || [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (q.type === 'mcq' || q.type === 'msq') {
                if (!q.correctIndices || q.correctIndices.length === 0) {
                    alert(`Question ${i + 1} (${q.type.toUpperCase()}) must have at least one correct answer selected.`);
                    return false;
                }
            } else if (q.type === 'number') {
                if (!q.numberRange || (q.numberRange.min === undefined && q.numberRange.max === undefined)) {
                    alert(`Question ${i + 1} (Number) must have a valid range.`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleProceedToDeployment = () => {
        if (validateQuestions()) {
            // Finalize questions: Convert indices to values and fill empty options
            const finalizedQuestions = currentTest.questions.map((q: any) => {
                if (q.type === 'mcq' || q.type === 'msq') {
                    // Fill empty options
                    const finalOptions = q.options.map((opt: string, idx: number) => opt.trim() === '' ? `Option ${idx + 1}` : opt);

                    // Map indices to values
                    const finalCorrectAnswers = q.correctIndices.map((idx: number) => finalOptions[idx]);

                    return {
                        ...q,
                        options: finalOptions,
                        correctAnswers: finalCorrectAnswers
                    };
                }
                return q;
            });

            setCurrentTest({ ...currentTest, questions: finalizedQuestions });
            setView('deployment');
        }
    };
    const handleDeploy = async () => {
        // Validation
        if (!currentTest.deployment?.department || currentTest.deployment.department.length === 0 || !currentTest.deployment?.year || !currentTest.deployment?.course) {
            alert('Please select at least one department, year, and course.');
            return;
        }

        if (!currentTest.deployment?.startTime || !currentTest.deployment?.endTime || !currentTest.deployment?.durationMinutes) {
            alert('Please set start time, end time, and duration.');
            return;
        }

        if (new Date(currentTest.deployment.startTime) >= new Date(currentTest.deployment.endTime)) {
            alert('End time must be after start time.');
            return;
        }

        if (currentTest.config?.timerPerQuestion && !currentTest.config?.timePerQuestion) {
            alert('Please set time per question if timer is enabled.');
            return;
        }

        setLoading(true);
        try {
            // Sanitize payload: Remove internal fields like correctIndices
            const sanitizedQuestions = currentTest.questions.map((q: any) => {
                const { correctIndices, ...rest } = q;
                return rest;
            });

            const payload = {
                ...currentTest,
                questions: sanitizedQuestions
            };

            // First save/update the test
            const saveRes = await fetch('/api/admin/online-test/save', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            const saveData = await saveRes.json();

            if (!saveData.success) {
                alert('Failed to save test: ' + (saveData.error || 'Unknown error'));
                setLoading(false);
                return;
            }

            // Then deploy
            const deployRes = await fetch('/api/admin/online-test/deploy', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    _id: saveData.test._id,
                    deployment: currentTest.deployment,
                    config: currentTest.config
                })
            });
            const deployData = await deployRes.json();

            if (deployData.success) {
                alert('Test Deployed Successfully!');
                setView('dashboard');
                fetchTests();
            } else {
                alert('Failed to deploy test: ' + deployData.error);
            }
        } catch (error) {
            console.error('Deployment error:', error);
            alert('An error occurred during deployment.');
        } finally {
            setLoading(false);
        }
    };

    const filteredQuestions = availableQuestions.filter(q => {
        if (filters.topic && q.topic !== filters.topic) return false;
        if (filters.subtopic && q.subtopic !== filters.subtopic) return false;
        if (filters.type && q.type !== filters.type) return false;
        return true;
    });

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Online Tests</h1>
                    <p className="text-slate-400 text-sm">Create, manage, and deploy online examinations</p>
                </div>
                {view === 'dashboard' && (
                    <button
                        onClick={handleCreateNew}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="h-5 w-5" /> Create New Test
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col relative">

                {/* VIEW: DASHBOARD */}
                {view === 'dashboard' && (
                    <div className="p-6">
                        {tests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                <FileText className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No tests created yet</p>
                                <p className="text-sm">Click "Create New Test" to get started</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tests.map((test: any) => (
                                    <div key={test._id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-indigo-500/50 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${test.status === 'deployed' ? 'bg-green-500/20 text-green-400' :
                                                test.status === 'completed' ? 'bg-slate-700 text-slate-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {test.status}
                                            </span>
                                        </div>
                                        <h3 className="text-white font-bold mb-1 truncate">{test.title}</h3>
                                        <p className="text-slate-400 text-xs mb-4 line-clamp-2">{test.description || 'No description provided.'}</p>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                <span>{test.deployment?.department || 'N/A'} - {test.deployment?.year || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>{test.deployment?.durationMinutes || 0}m</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setCurrentTest(test);
                                                    setView('editor'); // Or selection, depending on flow
                                                }}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Edit className="h-3 w-3" /> Edit
                                            </button>
                                            {test.status !== 'deployed' && (
                                                <button
                                                    onClick={() => {
                                                        setCurrentTest(test);
                                                        handleDeploy(); // This might need adjustment to just open deployment view
                                                        setView('deployment');
                                                    }}
                                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Check className="h-3 w-3" /> Deploy
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW: SELECTION */}
                {view === 'selection' && (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900">
                            <div>
                                <h2 className="text-lg font-bold text-white">Step 1: Select Questions</h2>
                                <p className="text-xs text-slate-400">{selectedQuestionIds.size} questions selected</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedQuestionIds.size === 0) {
                                            setCurrentTest({ ...currentTest, questions: [] });
                                        }
                                        handleProceedToEditor();
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded font-medium text-sm shadow-lg shadow-indigo-500/20 transition-all"
                                >
                                    Create Manually
                                </button>
                                <button
                                    onClick={handleProceedToEditor}
                                    disabled={selectedQuestionIds.size === 0}
                                    className={`px-4 py-1.5 rounded font-medium flex items-center gap-2 ${selectedQuestionIds.size > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                >
                                    Proceed with Selection <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="p-4 bg-slate-900/50 border-b border-white/5 flex gap-4 flex-wrap">
                            <select
                                className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-indigo-500"
                                value={filters.topic}
                                onChange={e => setFilters({ ...filters, topic: e.target.value })}
                            >
                                <option value="">All Topics</option>
                                {topics.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select
                                className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-indigo-500"
                                value={filters.subtopic}
                                onChange={e => setFilters({ ...filters, subtopic: e.target.value })}
                            >
                                <option value="">All Subtopics</option>
                                {subtopics.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Question List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="text-center py-10 text-slate-500">Loading questions...</div>
                            ) : filteredQuestions.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">No questions found matching filters.</div>
                            ) : (
                                filteredQuestions.map(q => (
                                    <div
                                        key={q.id}
                                        onClick={() => toggleQuestionSelection(q)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedQuestionIds.has(q.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2">
                                                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">{q.topic}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${q.type === 'mcq' ? 'bg-purple-900 text-purple-200' : q.type === 'blanks' ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'}`}>
                                                    {q.type}
                                                </span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedQuestionIds.has(q.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500'}`}>
                                                {selectedQuestionIds.has(q.id) && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-300">
                                            <Latex>{q.text}</Latex>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW: EDITOR */}
                {view === 'editor' && (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900">
                            <div>
                                <h2 className="text-lg font-bold text-white">Step 2: Edit & Configure</h2>
                                <p className="text-xs text-slate-400">Configure marks, types, and answers for {currentTest?.questions?.length || 0} questions</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setView('selection')} className="text-slate-400 hover:text-white px-3 py-1 text-sm">Back</button>
                                <button
                                    onClick={handleProceedToDeployment}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded font-medium flex items-center gap-2"
                                >
                                    Next: Deployment <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Question List & JSON Editor */}
                            <div className="w-1/2 border-r border-white/5 flex flex-col bg-slate-900/30">
                                <div className="p-2 border-b border-white/5 bg-slate-900/50 flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Questions</h3>
                                    <button
                                        onClick={() => {
                                            const newQuestion = {
                                                id: `new_${Date.now()}`,
                                                text: 'New Question',
                                                type: 'broad',
                                                marks: 1,
                                                negativeMarks: 0,
                                                options: [],
                                                correctAnswers: []
                                            };
                                            setCurrentTest({ ...currentTest, questions: [...currentTest.questions, newQuestion] });
                                        }}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" /> Add
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {currentTest?.questions?.map((q: any, idx: number) => (
                                        <div key={idx} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-bold text-slate-500">Q{idx + 1}</span>
                                                <button
                                                    onClick={() => {
                                                        const newQuestions = [...currentTest.questions];
                                                        newQuestions.splice(idx, 1);
                                                        setCurrentTest({ ...currentTest, questions: newQuestions });
                                                    }}
                                                    className="text-slate-600 hover:text-red-400"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* JSON Editor Toggle */}
                                            <div className="mb-2">
                                                <details className="text-xs" open>
                                                    <summary className="cursor-pointer text-indigo-400 hover:text-indigo-300 select-none">JSON Editor</summary>
                                                    <textarea
                                                        className="w-full h-48 bg-slate-950 text-green-400 font-mono text-xs p-2 mt-2 rounded border border-slate-700 focus:border-indigo-500 outline-none"
                                                        value={JSON.stringify(q, null, 2)}
                                                        onChange={(e) => {
                                                            try {
                                                                const parsed = JSON.parse(e.target.value);
                                                                const newQuestions = [...currentTest.questions];

                                                                // Intelligent MCQ Parsing from JSON text change
                                                                if (parsed.type === 'mcq' && parsed.text !== q.text) {
                                                                    const text = parsed.text || '';
                                                                    const optionRegex = /(?:^|\s)(?:\(?([a-d])\)|([a-d])\.)\s+(.*?)(?=(?:(?:\(?([a-d])\)|([a-d])\.)\s+)|$)/gi;
                                                                    const matches = [];
                                                                    let match;
                                                                    while ((match = optionRegex.exec(text)) !== null) {
                                                                        matches.push(match[3].trim());
                                                                    }
                                                                    if (matches.length >= 2) {
                                                                        parsed.options = matches;
                                                                    }
                                                                }

                                                                newQuestions[idx] = parsed;
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            } catch (err) {
                                                                // Invalid JSON, ignore
                                                            }
                                                        }}
                                                    />
                                                </details>
                                            </div>

                                            {/* Image Upload */}
                                            <div>
                                                <label className="block text-[10px] text-slate-400 uppercase mb-1">Image (Optional)</label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const newQuestions = [...currentTest.questions];
                                                                newQuestions[idx].image = reader.result as string;
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                {q.image && (
                                                    <div className="mt-2 relative inline-block group">
                                                        <img src={q.image} alt="Preview" className="h-16 rounded border border-slate-700" />
                                                        <button
                                                            onClick={() => {
                                                                const newQuestions = [...currentTest.questions];
                                                                newQuestions[idx].image = null;
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            }}
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Configuration Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 uppercase mb-1">Type</label>
                                                    <select
                                                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                        value={q.type || 'broad'}
                                                        onChange={(e) => {
                                                            const newQuestions = [...currentTest.questions];
                                                            newQuestions[idx].type = e.target.value;
                                                            setCurrentTest({ ...currentTest, questions: newQuestions });
                                                        }}
                                                    >
                                                        <option value="broad">Broad</option>
                                                        <option value="mcq">MCQ</option>
                                                        <option value="msq">MSQ</option>
                                                        <option value="number">Number</option>
                                                        <option value="blanks">Fill in Blanks</option>
                                                    </select>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-slate-400 uppercase mb-1">Marks</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                            value={q.marks || 0}
                                                            onChange={(e) => {
                                                                const newQuestions = [...currentTest.questions];
                                                                newQuestions[idx].marks = parseFloat(e.target.value);
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-slate-400 uppercase mb-1">Neg. Marks</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                            value={q.negativeMarks || 0}
                                                            onChange={(e) => {
                                                                const newQuestions = [...currentTest.questions];
                                                                newQuestions[idx].negativeMarks = parseFloat(e.target.value);
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Options / Answer Configuration */}
                                            {(q.type === 'mcq' || q.type === 'msq') && (
                                                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                                                    <label className="block text-[10px] text-slate-400 uppercase">Options & Correct Answer</label>
                                                    {q.options?.map((opt: string, optIdx: number) => (
                                                        <div key={optIdx} className="flex gap-2 items-center">
                                                            <input
                                                                type={q.type === 'mcq' ? 'radio' : 'checkbox'}
                                                                name={`q${idx}-correct`}
                                                                checked={q.correctIndices?.includes(optIdx) || false}
                                                                onChange={(e) => {
                                                                    const newQuestions = [...currentTest.questions];
                                                                    if (q.type === 'mcq') {
                                                                        newQuestions[idx].correctIndices = [optIdx];
                                                                    } else {
                                                                        const current = newQuestions[idx].correctIndices || [];
                                                                        if (e.target.checked) {
                                                                            newQuestions[idx].correctIndices = [...current, optIdx];
                                                                        } else {
                                                                            newQuestions[idx].correctIndices = current.filter((i: number) => i !== optIdx);
                                                                        }
                                                                    }
                                                                    setCurrentTest({ ...currentTest, questions: newQuestions });
                                                                }}
                                                                className="accent-indigo-500"
                                                            />
                                                            <input
                                                                type="text"
                                                                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                                value={opt || ''}
                                                                onChange={(e) => {
                                                                    const newQuestions = [...currentTest.questions];
                                                                    const oldVal = newQuestions[idx].options[optIdx];
                                                                    const newVal = e.target.value;

                                                                    // Update option text
                                                                    newQuestions[idx].options[optIdx] = newVal;

                                                                    // Sync correct answer if this option was selected
                                                                    if (newQuestions[idx].correctAnswers?.includes(oldVal)) {
                                                                        newQuestions[idx].correctAnswers = newQuestions[idx].correctAnswers.map((a: string) => a === oldVal ? newVal : a);
                                                                    }

                                                                    setCurrentTest({ ...currentTest, questions: newQuestions });
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newQuestions = [...currentTest.questions];
                                                                    newQuestions[idx].options.splice(optIdx, 1);
                                                                    setCurrentTest({ ...currentTest, questions: newQuestions });
                                                                }}
                                                                className="text-slate-600 hover:text-red-400"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            const newQuestions = [...currentTest.questions];
                                                            if (!newQuestions[idx].options) newQuestions[idx].options = [];
                                                            newQuestions[idx].options.push(`Option ${newQuestions[idx].options.length + 1}`);
                                                            setCurrentTest({ ...currentTest, questions: newQuestions });
                                                        }}
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                    >
                                                        <Plus className="h-3 w-3" /> Add Option
                                                    </button>
                                                </div>
                                            )}

                                            {q.type === 'blanks' && (
                                                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                                                    <label className="block text-[10px] text-slate-400 uppercase">Accepted Answers</label>
                                                    <p className="text-[10px] text-slate-500">Enter exact text or a range <code>[min, max]</code></p>
                                                    {q.correctAnswers?.map((ans: string, ansIdx: number) => (
                                                        <div key={ansIdx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                className="flex-1 bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                                value={ans || ''}
                                                                placeholder="Answer or [min, max]"
                                                                onChange={(e) => {
                                                                    const newQuestions = [...currentTest.questions];
                                                                    if (!newQuestions[idx].correctAnswers) newQuestions[idx].correctAnswers = [];
                                                                    newQuestions[idx].correctAnswers[ansIdx] = e.target.value;
                                                                    setCurrentTest({ ...currentTest, questions: newQuestions });
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newQuestions = [...currentTest.questions];
                                                                    newQuestions[idx].correctAnswers.splice(ansIdx, 1);
                                                                    setCurrentTest({ ...currentTest, questions: newQuestions });
                                                                }}
                                                                className="text-slate-600 hover:text-red-400"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            const newQuestions = [...currentTest.questions];
                                                            if (!newQuestions[idx].correctAnswers) newQuestions[idx].correctAnswers = [];
                                                            newQuestions[idx].correctAnswers.push('');
                                                            setCurrentTest({ ...currentTest, questions: newQuestions });
                                                        }}
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                    >
                                                        <Plus className="h-3 w-3" /> Add Answer
                                                    </button>
                                                </div>
                                            )}

                                            {q.type === 'number' && (
                                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/50">
                                                    <div>
                                                        <label className="block text-[10px] text-slate-400 uppercase mb-1">Min Value</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                            value={q.numberRange?.min || ''}
                                                            onChange={(e) => {
                                                                const newQuestions = [...currentTest.questions];
                                                                if (!newQuestions[idx].numberRange) newQuestions[idx].numberRange = {};
                                                                newQuestions[idx].numberRange.min = parseFloat(e.target.value);
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-slate-400 uppercase mb-1">Max Value</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                                                            value={q.numberRange?.max || ''}
                                                            onChange={(e) => {
                                                                const newQuestions = [...currentTest.questions];
                                                                if (!newQuestions[idx].numberRange) newQuestions[idx].numberRange = {};
                                                                newQuestions[idx].numberRange.max = parseFloat(e.target.value);
                                                                setCurrentTest({ ...currentTest, questions: newQuestions });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Live Preview */}
                            <div className="w-1/2 bg-slate-950 p-4 overflow-y-auto custom-scrollbar">
                                <div className="p-2 border-b border-white/5 bg-slate-900/50 mb-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Preview</h3>
                                </div>
                                <div className="space-y-6">
                                    {currentTest?.questions?.map((q: any, idx: number) => (
                                        <div key={idx} className="bg-slate-900 rounded-lg p-6 border border-slate-800 shadow-sm">
                                            <div className="flex justify-between mb-4">
                                                <span className="font-bold text-white">Question {idx + 1}</span>
                                                <span className="text-xs font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded uppercase">{q.type} • {q.marks} Marks</span>
                                            </div>
                                            <div className="prose prose-sm prose-invert max-w-none mb-4 text-slate-300">
                                                <Latex>{q.text || ''}</Latex>
                                            </div>
                                            {q.image && (
                                                <div className="mb-4">
                                                    <img
                                                        src={q.image}
                                                        alt="Question"
                                                        className="max-h-64 object-contain rounded border border-slate-700"
                                                        style={{ filter: 'invert(1)', mixBlendMode: 'screen', opacity: 0.8 }}
                                                    />
                                                </div>
                                            )}

                                            {/* Options Preview */}
                                            {(q.type === 'mcq' || q.type === 'msq') && (
                                                <div className="space-y-2">
                                                    {q.options?.map((opt: string, i: number) => (
                                                        <div key={i} className="flex items-center gap-3 p-3 rounded border border-slate-800 bg-slate-900/50">
                                                            <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center">
                                                                <span className="text-[10px] text-slate-500">{String.fromCharCode(65 + i)}</span>
                                                            </div>
                                                            <span className="text-sm text-slate-400"><Latex>{opt}</Latex></span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW: DEPLOYMENT */}
                {view === 'deployment' && (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900">
                            <h2 className="text-lg font-bold text-white">Step 3: Deploy Test</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setView('editor')} className="text-slate-400 hover:text-white px-3 py-1 text-sm">Back</button>
                            </div>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Target Audience */}
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Users className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Target Audience</h3>
                                            <p className="text-sm text-slate-400">Who should take this test?</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Department (Multi-Select)</label>
                                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 max-h-32 overflow-y-auto custom-scrollbar">
                                                {depts.map(dept => (
                                                    <label key={dept} className="flex items-center gap-2 p-1 hover:bg-slate-800 rounded cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentTest?.deployment?.department?.includes(dept) || false}
                                                            onChange={(e) => {
                                                                const currentDepts = currentTest?.deployment?.department || [];
                                                                let newDepts;
                                                                if (e.target.checked) {
                                                                    newDepts = [...currentDepts, dept];
                                                                } else {
                                                                    newDepts = currentDepts.filter((d: string) => d !== dept);
                                                                }
                                                                setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, department: newDepts } });
                                                            }}
                                                            className="accent-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-300">{dept}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Year</label>
                                            <select
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                value={currentTest?.deployment?.year || ''}
                                                onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, year: e.target.value } })}
                                            >
                                                <option value="">Select Year</option>
                                                {years.map(y => {
                                                    const isNum = /^\d+$/.test(y);
                                                    const label = isNum ? (y === '1' ? '1st' : y === '2' ? '2nd' : y === '3' ? '3rd' : y + 'th') : y;
                                                    return <option key={y} value={y}>{label} Year</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Course</label>
                                            {courses.length > 0 ? (
                                                <select
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                    value={currentTest?.deployment?.course || ''}
                                                    onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, course: e.target.value } })}
                                                >
                                                    <option value="">Select Course</option>
                                                    {courses.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="e.g. CS101"
                                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                    value={currentTest?.deployment?.course || ''}
                                                    onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, course: e.target.value } })}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Schedule & Duration */}
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Clock className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Schedule & Duration</h3>
                                            <p className="text-sm text-slate-400">Set the time window and exam duration.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Window Start Time</label>
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                value={currentTest?.deployment?.startTime || ''}
                                                onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, startTime: e.target.value } })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Window End Time</label>
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                value={currentTest?.deployment?.endTime || ''}
                                                onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, endTime: e.target.value } })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Exam Duration (Minutes)</label>
                                            <input
                                                type="number"
                                                placeholder="e.g. 60"
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                value={currentTest?.deployment?.durationMinutes || ''}
                                                onChange={(e) => setCurrentTest({ ...currentTest, deployment: { ...currentTest.deployment, durationMinutes: parseInt(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Exam Settings */}
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Users className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Exam Settings</h3>
                                            <p className="text-sm text-slate-400">Configure proctoring and behavior.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Shuffle Questions */}
                                        <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                            <div>
                                                <h4 className="text-sm font-bold text-white">Shuffle Questions</h4>
                                                <p className="text-xs text-slate-400">Randomize question order for each student.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={currentTest?.config?.shuffle || false}
                                                    onChange={(e) => setCurrentTest({ ...currentTest, config: { ...currentTest.config, shuffle: e.target.checked } })}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>

                                        {/* Timer Per Question */}
                                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">Timer Per Question</h4>
                                                    <p className="text-xs text-slate-400">Enforce a time limit for each question.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={currentTest?.config?.timerPerQuestion || false}
                                                        onChange={(e) => setCurrentTest({ ...currentTest, config: { ...currentTest.config, timerPerQuestion: e.target.checked } })}
                                                    />
                                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                </label>
                                            </div>

                                            {currentTest?.config?.timerPerQuestion && (
                                                <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Time per Question (Seconds)</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500"
                                                            value={currentTest?.config?.timePerQuestion || ''}
                                                            onChange={(e) => setCurrentTest({ ...currentTest, config: { ...currentTest.config, timePerQuestion: parseInt(e.target.value) } })}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Allow Backtracking</label>
                                                            <p className="text-[10px] text-slate-500">Can students go back to previous questions?</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={currentTest?.config?.allowBackTracking || false}
                                                                onChange={(e) => setCurrentTest({ ...currentTest, config: { ...currentTest.config, allowBackTracking: e.target.checked } })}
                                                            />
                                                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button
                                        onClick={handleDeploy}
                                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-500/20 text-lg transition-all hover:scale-105"
                                    >
                                        <Check className="h-5 w-5" /> Deploy Test Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div >
    );
}
