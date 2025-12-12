'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Link as LinkIcon, FileText, Video, Brain, Copy, Check, Sparkles, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import LatexWrapper from '../assignments/components/LatexWrapper';

export default function Resources() {
    const [activeTab, setActiveTab] = useState('practice');
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    // Context Data
    const [allQuestions, setAllQuestions] = useState<any[]>([]);
    const [topics, setTopics] = useState<string[]>([]);
    const [subtopics, setSubtopics] = useState<string[]>([]);
    const [depts, setDepts] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>([]);
    const [courses, setCourses] = useState<string[]>([]);

    // Form States
    const [practiceForm, setPracticeForm] = useState({
        title: '', targetDepartments: [] as string[], targetYear: '', targetCourse: '',
        selectedTopics: [] as string[], selectedSubtopics: [] as string[], selectedQuestions: new Set<string>()
    });

    const [hintsForm, setHintsForm] = useState({
        title: '', targetDepartments: [] as string[], targetYear: '', targetCourse: '',
        selectedTopics: [] as string[], selectedQuestions: new Set<string>(),
        aiOutput: '', hintsData: [] as any[]
    });

    const [materialForm, setMaterialForm] = useState({
        title: '', url: '', targetDepartments: [] as string[], targetYear: '', targetCourse: ''
    });

    const [videoForm, setVideoForm] = useState({
        title: '', url: '', topic: '', subtopic: '',
        targetDepartments: [] as string[], targetYear: '', targetCourse: ''
    });

    const [submitting, setSubmitting] = useState(false);

    // AI Verification Control State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiEnabledTopics, setAiEnabledTopics] = useState<Set<string>>(new Set());

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        const ga = localStorage.getItem('globalAdminActive');
        if (ga === 'true') setIsGlobalAdmin(true);

        if (user) {
            fetchResources();
            fetchContextData();
        }
    }, [user]);

    const getHeaders = () => {
        const headers: any = { 'X-User-Email': user?.email || '' };
        const ga = localStorage.getItem('globalAdminActive'); // Read directly to be safe or use state
        if (ga === 'true' || isGlobalAdmin) {
            headers['X-Global-Admin-Key'] = 'globaladmin_25';
        }
        return headers;
    };

    const fetchResources = async () => {
        try {
            const res = await fetch('/api/admin/resources', {
                headers: getHeaders()
            });
            if (res.ok) setResources(await res.json());
        } catch (error) {
            console.error("Error fetching resources", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContextData = async () => {
        try {
            const [qRes, cRes] = await Promise.all([
                fetch('/api/admin/questions', { headers: getHeaders() }),
                fetch('/api/admin/config')
            ]);

            if (qRes.ok) {
                const qs = await qRes.json();
                setAllQuestions(qs);
                setTopics(Array.from(new Set(qs.map((q: any) => q.topic).filter(Boolean))).sort() as string[]);
                setSubtopics(Array.from(new Set(qs.map((q: any) => q.subtopic).filter(Boolean))).sort() as string[]);
            }

            if (cRes.ok) {
                const config = await cRes.json();
                const d = new Set<string>();
                const y = new Set<string>();
                const c = new Set<string>();

                const isGA = localStorage.getItem('globalAdminActive') === 'true';

                if (config.teacherAssignments) {
                    Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                        let include = false;
                        if (isGA) {
                            include = true;
                        } else if (Array.isArray(teachers) && teachers.some((t: any) => t.email === user?.email)) {
                            include = true;
                        }

                        if (include) {
                            const parts = key.split('_');
                            if (parts.length >= 3) {
                                d.add(parts[0]);
                                y.add(parts[1]);
                                c.add(parts[2]);
                            }
                        }
                    });
                }

                setDepts(Array.from(d).sort());
                setYears(Array.from(y).sort());
                setCourses(Array.from(c).sort());
            }
        } catch (error) {
            console.error("Error fetching context", error);
        }

        // Fetch AI Enabled Topics
        try {
            const aiRes = await fetch('/api/admin/ai-settings', { headers: getHeaders() });
            if (aiRes.ok) {
                const data = await aiRes.json();
                setAiEnabledTopics(new Set(data.enabledTopics || []));
            }
        } catch (error) {
            console.error("Error fetching AI settings", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this resource?')) return;
        try {
            const res = await fetch(`/api/admin/resources?id=${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) {
                toast.success('Resource deleted');
                fetchResources();
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Error deleting resource');
        }
    };

    // --- Practice Tab Logic ---
    const getFilteredQuestions = (type: 'practice' | 'hints') => {
        const form = type === 'practice' ? practiceForm : hintsForm;
        return allQuestions.filter(q => {
            const topicMatch = form.selectedTopics.length === 0 || form.selectedTopics.includes(q.topic);
            const subtopicMatch = type === 'hints' || (form as any).selectedSubtopics.length === 0 || (form as any).selectedSubtopics.includes(q.subtopic);
            return topicMatch && subtopicMatch;
        });
    };

    const toggleQuestion = (type: 'practice' | 'hints', id: string) => {
        const form = type === 'practice' ? practiceForm : hintsForm;
        const set = type === 'practice' ? setPracticeForm : setHintsForm;
        const newSet = new Set(form.selectedQuestions);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        set({ ...form, selectedQuestions: newSet } as any);
    };

    const toggleAll = (type: 'practice' | 'hints', select: boolean) => {
        const filtered = getFilteredQuestions(type);
        const form = type === 'practice' ? practiceForm : hintsForm;
        const set = type === 'practice' ? setPracticeForm : setHintsForm;
        const newSet = new Set(form.selectedQuestions);
        filtered.forEach(q => select ? newSet.add(q._id) : newSet.delete(q._id));
        set({ ...form, selectedQuestions: newSet } as any);
    };

    const submitPractice = async () => {
        if (practiceForm.selectedQuestions.size === 0) return toast.error('Select at least one question');
        if (!practiceForm.title) return toast.error('Title is required');

        setSubmitting(true);
        try {
            const payload = {
                title: practiceForm.title,
                type: 'practice',
                questions: Array.from(practiceForm.selectedQuestions),
                targetDepartments: practiceForm.targetDepartments,
                targetYear: practiceForm.targetYear,
                targetCourse: practiceForm.targetCourse,
                facultyName: user.name
            };

            const res = await fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Practice Set Published!');
                setPracticeForm({ ...practiceForm, title: '', selectedQuestions: new Set() });
                fetchResources();
            }
        } finally {
            setSubmitting(false);
        }
    };

    // --- Hints Tab Logic ---
    const copyPrompt = () => {
        if (hintsForm.selectedQuestions.size === 0) return toast.error('Select questions first');

        const selectedData = allQuestions.filter(q => hintsForm.selectedQuestions.has(q._id)).map(q => ({
            id: q._id,
            topic: q.topic,
            content: q.text
        }));

        const prompt = `I am providing a list of academic questions in JSON format. Please act as a tutor and generate "hints" for each question. The hints should guide the student step-by-step to the solution without revealing the final answer directly.
            
IMPORTANT: When generating LaTeX math inside the JSON strings, strictly use DOUBLE BACKSLASHES (\\\\) for all latex commands instead of single backslashes. For example, use \\\\frac{a}{b} instead of \\frac{a}{b}. This is crucial for valid JSON parsing.

Output ONLY a valid JSON array matching the input structure, but add a "hints" field (array of strings) to each object. Do not output markdown backticks.

Example Output format:
[
  {
    "id": "q_1",
    "topic": "Math",
    "content": "Solve x+2=4",
    "hints": ["Isolate x by subtracting 2 from both sides.", "Check your answer."]
  }
]

Input Data:
${JSON.stringify(selectedData, null, 2)}`;

        navigator.clipboard.writeText(prompt)
            .then(() => toast.success('Copied!'))
            .catch(() => toast.error('Failed to copy'));
    };

    const handleAiInput = (e: any) => {
        const val = e.target.value;
        setHintsForm({ ...hintsForm, aiOutput: val });

        if (!val.trim()) {
            setHintsForm(prev => ({ ...prev, hintsData: [] }));
            return;
        }
        try {
            const cleanJson = val.replace(/^```json/, '').replace(/```$/, '');
            const data = JSON.parse(cleanJson);
            if (Array.isArray(data)) {
                setHintsForm(prev => ({ ...prev, hintsData: data }));
            }
        } catch (err) {
            // Silent fail on parse error while typing
        }
    };

    const submitHints = async () => {
        if (!hintsForm.hintsData.length) return toast.error('Invalid or missing AI output');
        if (!hintsForm.title) return toast.error('Title is required');

        setSubmitting(true);
        try {
            const hintsMap: any = {};
            hintsForm.hintsData.forEach(h => hintsMap[h.id] = h.hints);

            const payload = {
                title: hintsForm.title,
                type: 'hints',
                questions: hintsForm.hintsData.map(h => h.id),
                hints: hintsMap,
                targetDepartments: hintsForm.targetDepartments,
                targetYear: hintsForm.targetYear,
                targetCourse: hintsForm.targetCourse,
                facultyName: user.name
            };

            const res = await fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Hints Resource Published!');
                setHintsForm({ ...hintsForm, title: '', aiOutput: '', hintsData: [], selectedQuestions: new Set() });
                fetchResources();
            }
        } finally {
            setSubmitting(false);
        }
    };

    // --- Material & Video Logic ---
    const submitMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...materialForm, type: 'pdf', facultyName: user.name };
            const res = await fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success('Material Uploaded!');
                setMaterialForm({ title: '', url: '', targetDepartments: [], targetYear: '', targetCourse: '' });
                fetchResources();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const submitVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...videoForm, type: 'video', videoLink: videoForm.url, facultyName: user.name };
            const res = await fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success('Video Deployed!');
                setVideoForm({ title: '', url: '', topic: '', subtopic: '', targetDepartments: [], targetYear: '', targetCourse: '' });
                fetchResources();
            }
        } finally {
            setSubmitting(false);
        }
    };


    // AI Settings Handlers
    const toggleAITopic = (topic: string) => {
        const newSet = new Set(aiEnabledTopics);
        if (newSet.has(topic)) {
            newSet.delete(topic);
        } else {
            newSet.add(topic);
        }
        setAiEnabledTopics(newSet);
    };

    const saveAISettings = async () => {
        try {
            const res = await fetch('/api/admin/ai-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ enabledTopics: Array.from(aiEnabledTopics) })
            });

            if (res.ok) {
                toast.success('AI Settings Saved!');
                setShowAIModal(false);
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            toast.error('Error saving AI settings');
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* AI Control Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowAIModal(true)}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all"
                >
                    <Sparkles className="h-4 w-4" />
                    Enable AI Answer Verification
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {[
                        { id: 'practice', label: 'Practice Questions' },
                        { id: 'hints', label: 'Practice (Hints)' },
                        { id: 'materials', label: 'Study Materials (PDF)' },
                        { id: 'videos', label: 'Video Resources' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Panels */}
            <div className={activeTab === 'hints' ? "block space-y-8" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
                <div className={activeTab === 'hints' ? "w-full space-y-6" : "lg:col-span-2 space-y-6"}>

                    {/* Practice Tab */}
                    {activeTab === 'practice' && (
                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                            <h2 className="text-xl font-bold text-white">Select Questions</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Filter Topic</label>
                                    <select
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPracticeForm(p => ({ ...p, selectedTopics: val ? [val] : [] }));
                                        }}
                                    >
                                        <option value="">All Topics</option>
                                        {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Filter Subtopic</label>
                                    <select
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPracticeForm(p => ({ ...p, selectedSubtopics: val ? [val] : [] }));
                                        }}
                                    >
                                        <option value="">All Subtopics</option>
                                        {subtopics.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm text-gray-400">
                                <span>{practiceForm.selectedQuestions.size} selected</span>
                                <div className="space-x-2">
                                    <button onClick={() => toggleAll('practice', true)} className="text-blue-400 hover:underline">Select All</button>
                                    <button onClick={() => toggleAll('practice', false)} className="text-gray-400 hover:underline">Deselect All</button>
                                </div>
                            </div>

                            <div className="bg-gray-900 border border-gray-700 rounded-lg h-96 overflow-y-auto p-4 space-y-2">
                                {getFilteredQuestions('practice').map(q => (
                                    <label key={q._id} className="flex items-start gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer border-b border-gray-800 last:border-0">
                                        <input
                                            type="checkbox"
                                            checked={practiceForm.selectedQuestions.has(q._id)}
                                            onChange={() => toggleQuestion('practice', q._id)}
                                            className="mt-1 w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                                        />
                                        <div className="flex-1 text-sm">
                                            <div className="flex gap-2 mb-1">
                                                <span className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">{q.topic}</span>
                                                <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{q.subtopic}</span>
                                            </div>
                                            <div className="text-gray-300"><LatexWrapper>{q.text}</LatexWrapper></div>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-700">
                                <input
                                    type="text" placeholder="Resource Title"
                                    className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                    value={practiceForm.title} onChange={e => setPracticeForm({ ...practiceForm, title: e.target.value })}
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative">
                                        <button
                                            type="button"
                                            className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full text-left flex justify-between items-center"
                                            onClick={() => document.getElementById('dept-dropdown-practice')?.classList.toggle('hidden')}
                                        >
                                            <span className="truncate">{practiceForm.targetDepartments.length ? `${practiceForm.targetDepartments.length} Depts` : 'Select Departments'}</span>
                                            <span className="text-xs">▼</span>
                                        </button>
                                        <div id="dept-dropdown-practice" className="hidden absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                            {depts.map(d => (
                                                <label key={d} className="flex items-center gap-2 p-2 hover:bg-gray-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={practiceForm.targetDepartments.includes(d)}
                                                        onChange={(e) => {
                                                            const newDepts = e.target.checked
                                                                ? [...practiceForm.targetDepartments, d]
                                                                : practiceForm.targetDepartments.filter(x => x !== d);
                                                            setPracticeForm({ ...practiceForm, targetDepartments: newDepts });
                                                        }}
                                                    />
                                                    <span className="text-sm text-white">{d}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <select
                                        className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                        value={practiceForm.targetYear} onChange={e => setPracticeForm({ ...practiceForm, targetYear: e.target.value })}
                                    >
                                        <option value="">Select Year</option>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                        value={practiceForm.targetCourse} onChange={e => setPracticeForm({ ...practiceForm, targetCourse: e.target.value })}
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={submitPractice} disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Publish Practice Set'}
                            </button>
                        </div>
                    )}

                    {/* Hints Tab */}
                    {activeTab === 'hints' && (
                        <div className="space-y-6">
                            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                                <h2 className="text-xl font-bold text-white">1. Select Questions</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <select
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setHintsForm(p => ({ ...p, selectedTopics: val ? [val] : [] }));
                                        }}
                                    >
                                        <option value="">All Topics</option>
                                        {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <div className="flex justify-end items-center gap-2 text-sm">
                                        <button onClick={() => toggleAll('hints', true)} className="text-blue-400 hover:underline">Select All</button>
                                        <button onClick={() => toggleAll('hints', false)} className="text-gray-400 hover:underline">Deselect All</button>
                                    </div>
                                </div>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg h-48 overflow-y-auto p-4 space-y-2">
                                    {getFilteredQuestions('hints').map(q => (
                                        <label key={q._id} className="flex items-start gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer border-b border-gray-800 last:border-0">
                                            <input
                                                type="checkbox"
                                                checked={hintsForm.selectedQuestions.has(q._id)}
                                                onChange={() => toggleQuestion('hints', q._id)}
                                                className="mt-1 w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                                            />
                                            <div className="flex-1 text-sm text-gray-300"><LatexWrapper>{q.text}</LatexWrapper></div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                                <h2 className="text-xl font-bold text-white">2. AI Generation</h2>
                                <div className="space-y-4">
                                    <button onClick={copyPrompt} className="w-full bg-purple-900/50 hover:bg-purple-900/70 text-purple-200 py-3 rounded border border-purple-500 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]">
                                        <Copy className="h-4 w-4" /> Copy Prompt & Data (JSON)
                                    </button>
                                    <div className="flex gap-2">
                                        <a href="https://gemini.google.com/app" target="_blank" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-center text-xs font-bold transition-colors">Gemini</a>
                                        <a href="https://chatgpt.com/" target="_blank" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-center text-xs font-bold transition-colors">ChatGPT</a>
                                        <a href="https://www.perplexity.ai/" target="_blank" className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2 rounded text-center text-xs font-bold transition-colors">Perplexity</a>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col transition-all duration-300">
                                <div className="bg-gray-900 p-4 border-b border-gray-700">
                                    <h2 className="text-xl font-bold text-white">3. Paste JSON & Preview</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 h-[500px]">
                                    <div className="p-4 border-r border-gray-700 flex flex-col gap-4 bg-gray-900">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Paste AI Output (JSON) below</span>
                                        </div>
                                        <textarea
                                            className="flex-1 bg-gray-800 border border-gray-600 text-green-400 font-mono p-4 rounded focus:outline-none focus:border-blue-500 text-sm leading-relaxed resize-none whitespace-pre-wrap"
                                            placeholder="Paste JSON here..."
                                            value={hintsForm.aiOutput}
                                            onChange={handleAiInput}
                                        ></textarea>
                                    </div>

                                    <div className="flex flex-col bg-gray-100 h-full min-h-0">
                                        <div className="bg-gray-200 px-4 py-2 border-b border-gray-300 flex justify-between items-center shrink-0">
                                            <h4 className="text-xs font-bold text-gray-600 uppercase">Live Preview</h4>
                                            <span className="text-xs text-gray-500">{hintsForm.hintsData.length} items</span>
                                        </div>
                                        <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0">
                                            {hintsForm.hintsData.length > 0 ? (
                                                hintsForm.hintsData.map((h, i) => (
                                                    <div key={i} className="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 transition-colors group">
                                                        <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                                                            <div className="font-bold text-gray-800 text-sm">{h.topic || 'Question'}</div>
                                                        </div>
                                                        <div className="text-gray-800 text-sm mb-2"><LatexWrapper>{h.content}</LatexWrapper></div>
                                                        <div className="pl-3 border-l-2 border-green-600 bg-green-50 p-2 rounded-r">
                                                            <span className="text-xs text-green-700 font-bold uppercase">Hints:</span>
                                                            <ul className="list-disc list-inside text-gray-600 text-xs mt-1 space-y-1">
                                                                {h.hints.map((hint: string, j: number) => <li key={j}><LatexWrapper>{hint}</LatexWrapper></li>)}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center text-gray-400 mt-10 italic">Preview will appear here after pasting valid JSON...</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                                <h2 className="text-xl font-bold text-white">4. Deploy</h2>
                                <input
                                    type="text" placeholder="Resource Title"
                                    className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                    value={hintsForm.title} onChange={e => setHintsForm({ ...hintsForm, title: e.target.value })}
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative">
                                        <button
                                            type="button"
                                            className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full text-left flex justify-between items-center"
                                            onClick={() => document.getElementById('dept-dropdown-hints')?.classList.toggle('hidden')}
                                        >
                                            <span className="truncate">{hintsForm.targetDepartments.length ? `${hintsForm.targetDepartments.length} Depts` : 'Select Departments'}</span>
                                            <span className="text-xs">▼</span>
                                        </button>
                                        <div id="dept-dropdown-hints" className="hidden absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                            {depts.map(d => (
                                                <label key={d} className="flex items-center gap-2 p-2 hover:bg-gray-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={hintsForm.targetDepartments.includes(d)}
                                                        onChange={(e) => {
                                                            const newDepts = e.target.checked
                                                                ? [...hintsForm.targetDepartments, d]
                                                                : hintsForm.targetDepartments.filter(x => x !== d);
                                                            setHintsForm({ ...hintsForm, targetDepartments: newDepts });
                                                        }}
                                                    />
                                                    <span className="text-sm text-white">{d}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <select
                                        className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                        value={hintsForm.targetYear} onChange={e => setHintsForm({ ...hintsForm, targetYear: e.target.value })}
                                    >
                                        <option value="">Select Year</option>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                    <select
                                        className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full"
                                        value={hintsForm.targetCourse} onChange={e => setHintsForm({ ...hintsForm, targetCourse: e.target.value })}
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <button
                                    onClick={submitHints} disabled={submitting}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Publish with Hints'}
                                </button>
                            </div>

                            {/* Deployed Resources (Moved here for Hints tab) */}
                            <div className="mt-8">
                                {renderDeployedResources()}
                            </div>
                        </div>
                    )}

                    {/* Materials Tab */}
                    {activeTab === 'materials' && (
                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                            <h2 className="text-xl font-bold text-white mb-6">Upload Study Material (PDF)</h2>
                            <form onSubmit={submitMaterial} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Title</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        value={materialForm.title} onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Drive/File URL</label>
                                    <input
                                        type="url" required
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        value={materialForm.url} onChange={e => setMaterialForm({ ...materialForm, url: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Departments</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full text-left flex justify-between items-center"
                                                onClick={() => document.getElementById('dept-dropdown-material')?.classList.toggle('hidden')}
                                            >
                                                <span className="truncate">{materialForm.targetDepartments.length ? `${materialForm.targetDepartments.length} Depts` : 'Select Departments'}</span>
                                                <span className="text-xs">▼</span>
                                            </button>
                                            <div id="dept-dropdown-material" className="hidden absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                                {depts.map(d => (
                                                    <label key={d} className="flex items-center gap-2 p-2 hover:bg-gray-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={materialForm.targetDepartments.includes(d)}
                                                            onChange={(e) => {
                                                                const newDepts = e.target.checked
                                                                    ? [...materialForm.targetDepartments, d]
                                                                    : materialForm.targetDepartments.filter(x => x !== d);
                                                                setMaterialForm({ ...materialForm, targetDepartments: newDepts });
                                                            }}
                                                        />
                                                        <span className="text-sm text-white">{d}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Year</label>
                                        <select
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={materialForm.targetYear} onChange={e => setMaterialForm({ ...materialForm, targetYear: e.target.value })}
                                        >
                                            <option value="">Select Year</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Course</label>
                                        <select
                                            required
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={materialForm.targetCourse} onChange={e => setMaterialForm({ ...materialForm, targetCourse: e.target.value })}
                                        >
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="submit" disabled={submitting}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Upload & Deploy'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Videos Tab */}
                    {activeTab === 'videos' && (
                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                            <h2 className="text-xl font-bold text-white mb-6">Deploy YouTube Video</h2>
                            <form onSubmit={submitVideo} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Topic</label>
                                        <input
                                            type="text" required list="topics-list"
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={videoForm.topic} onChange={e => setVideoForm({ ...videoForm, topic: e.target.value })}
                                        />
                                        <datalist id="topics-list">{topics.map(t => <option key={t} value={t} />)}</datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Subtopic</label>
                                        <input
                                            type="text" list="subtopics-list"
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={videoForm.subtopic} onChange={e => setVideoForm({ ...videoForm, subtopic: e.target.value })}
                                        />
                                        <datalist id="subtopics-list">{subtopics.map(t => <option key={t} value={t} />)}</datalist>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Title</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        value={videoForm.title} onChange={e => setVideoForm({ ...videoForm, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">YouTube Link</label>
                                    <input
                                        type="url" required
                                        className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                        value={videoForm.url} onChange={e => setVideoForm({ ...videoForm, url: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Departments</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                className="bg-gray-700 border-gray-600 rounded text-white p-2 w-full text-left flex justify-between items-center"
                                                onClick={() => document.getElementById('dept-dropdown-video')?.classList.toggle('hidden')}
                                            >
                                                <span className="truncate">{videoForm.targetDepartments.length ? `${videoForm.targetDepartments.length} Depts` : 'Select Departments'}</span>
                                                <span className="text-xs">▼</span>
                                            </button>
                                            <div id="dept-dropdown-video" className="hidden absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                                {depts.map(d => (
                                                    <label key={d} className="flex items-center gap-2 p-2 hover:bg-gray-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={videoForm.targetDepartments.includes(d)}
                                                            onChange={(e) => {
                                                                const newDepts = e.target.checked
                                                                    ? [...videoForm.targetDepartments, d]
                                                                    : videoForm.targetDepartments.filter(x => x !== d);
                                                                setVideoForm({ ...videoForm, targetDepartments: newDepts });
                                                            }}
                                                        />
                                                        <span className="text-sm text-white">{d}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Year</label>
                                        <select
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={videoForm.targetYear} onChange={e => setVideoForm({ ...videoForm, targetYear: e.target.value })}
                                        >
                                            <option value="">Select Year</option>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Course</label>
                                        <select
                                            required
                                            className="w-full bg-gray-700 border-gray-600 rounded text-white p-2"
                                            value={videoForm.targetCourse} onChange={e => setVideoForm({ ...videoForm, targetCourse: e.target.value })}
                                        >
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="submit" disabled={submitting}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Deploy Video Resource'}
                                </button>
                            </form>
                        </div>
                    )}

                </div>

                {/* Resource Log (Sidebar) */}
                <div className={activeTab === 'hints' ? "hidden" : "lg:col-span-1"}>
                    {renderDeployedResources()}
                </div>
            </div >

            {/* AI Topic Control Modal */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-cyan-500/30 w-full max-w-2xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-white/20">
                                        <Sparkles className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Enable AI Answer Verification</h3>
                                        <p className="text-cyan-100 text-sm">Select topics that will have AI verification available</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAIModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm text-gray-400">
                                    {aiEnabledTopics.size} of {topics.length} topics enabled
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAiEnabledTopics(new Set(topics))}
                                        className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setAiEnabledTopics(new Set())}
                                        className="text-xs px-3 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {topics.map(topic => (
                                    <label
                                        key={topic}
                                        className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg cursor-pointer border border-gray-700 hover:border-cyan-500/30 transition-all group"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={aiEnabledTopics.has(topic)}
                                            onChange={() => toggleAITopic(topic)}
                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                                            {topic}
                                        </span>
                                        {aiEnabledTopics.has(topic) && (
                                            <Check className="h-4 w-4 text-cyan-400" />
                                        )}
                                    </label>
                                ))}
                            </div>

                            {topics.length === 0 && (
                                <p className="text-center text-gray-500 py-8">No topics available. Add questions first.</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-gray-900/50 border-t border-gray-700 flex gap-3">
                            <button
                                onClick={() => setShowAIModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveAISettings}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Check className="h-4 w-4" />
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );

    function renderDeployedResources() {
        return (
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden sticky top-6">
                <div className="p-4 border-b border-white/10 bg-white/5">
                    <h2 className="text-lg font-bold text-white">Deployed Resources</h2>
                </div>
                <div className="max-h-[80vh] overflow-y-auto p-2 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6 text-blue-500" /></div>
                    ) : resources.length === 0 ? (
                        <p className="text-gray-500 text-center text-sm p-4">No resources found.</p>
                    ) : (
                        resources.map(r => (
                            <div key={r._id} className="bg-gray-900 p-3 rounded border border-gray-700 group relative">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-white font-medium text-sm line-clamp-2">{r.title}</h3>
                                    <button onClick={() => handleDelete(r._id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${r.type === 'practice' ? 'bg-blue-900 text-blue-300' :
                                        r.type === 'hints' ? 'bg-purple-900 text-purple-300' :
                                            r.type === 'video' ? 'bg-red-900 text-red-300' :
                                                'bg-green-900 text-green-300'
                                        }`}>{r.type}</span>
                                    <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{r.targetCourse || 'All'}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex justify-between">
                                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                                    {r.url && <a href={r.url} target="_blank" className="text-blue-400 hover:underline">Link</a>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }
}
