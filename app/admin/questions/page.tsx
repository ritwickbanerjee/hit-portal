'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Plus, FileJson, FileText, Trash2, Download, Save, X, Printer, Edit, Upload, Copy, ExternalLink, RefreshCw, Check, ChevronDown, ToggleLeft, ToggleRight, GraduationCap, ArrowLeft, ArrowRightCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

// --- MultiSelect Component ---
const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter((item: string) => item !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded p-2 text-xs min-h-[38px] flex items-center justify-between cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1">
                    {selected.length === 0 ? <span className="text-gray-500">{placeholder}</span> :
                        selected.length > 2 ? <span className="text-white">{selected.length} selected</span> :
                            selected.map((s: string) => (
                                <span key={s} className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                            ))}
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                    {selected.length > 0 && (
                        <div
                            className="px-3 py-2 hover:bg-red-900/30 cursor-pointer flex items-center gap-2 text-xs text-red-400 border-b border-gray-700 sticky top-0 bg-gray-800 z-10"
                            onClick={() => onChange([])}
                        >
                            <X className="h-3 w-3" /> Clear Selection
                        </div>
                    )}
                    {options.map((opt: string) => (
                        <div
                            key={opt}
                            className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-xs text-gray-300"
                            onClick={() => toggleOption(opt)}
                        >
                            <div className={`w-3 h-3 rounded border border-gray-500 flex items-center justify-center ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : ''}`}>
                                {selected.includes(opt) && <Check className="h-2 w-2 text-white" />}
                            </div>
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AI_PROMPT = `You are a Question Bank Assistant. Your task is to extract questions from the provided content and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each object must have the following fields:
   - "text": The question text. Use LaTeX for math.
     - IMPORTANT: Use ONLY single dollar signs ($...$) for ALL math expressions (inline and display). DO NOT use double dollar signs ($$...$$).
     - IMPORTANT: Escape ALL backslashes. Use double backslash (\\\\) for every single backslash in LaTeX commands. Example: use \\\\frac{a}{b} instead of \\frac{a}{b}.
   - "type": One of "broad", "mcq", "blanks".
   - "topic": Infer the specific topic (e.g., "Matrix", "Thermodynamics"). Avoid generic terms like "Math" or "Physics".
   - "subtopic": Infer the specific subtopic (e.g., "Rank", "Entropy").
3. If images are present, try to describe them using TikZ code within the "text" field, or provide a clear text description.
4. Do NOT wrap the output in markdown code blocks (like \`\`\`json). Return ONLY the raw JSON string.

Example Output:
[
  {
    "text": "Find the rank of the matrix $ A = \\\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\\\end{pmatrix} $",
    "type": "broad",
    "topic": "Matrix",
    "subtopic": "Rank"
  }
]
`;

export default function QuestionBank() {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'manual' | 'json' | 'pdf'>('manual');
    const [manualData, setManualData] = useState({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
    const [jsonContent, setJsonContent] = useState('');
    const [previewContent, setPreviewContent] = useState<any[]>([]);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Duplicate Detection State
    const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
    const [newQuestions, setNewQuestions] = useState<any[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Filter State
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

    // Paper Generator State
    const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
    const [paperStep, setPaperStep] = useState(0); // 0: Select, 1: Details, 2: Preview
    const [paperQuestions, setPaperQuestions] = useState<any[]>([]);
    const [paperHtml, setPaperHtml] = useState('');
    const [paperJson, setPaperJson] = useState('');
    const [paperConfig, setPaperConfig] = useState({
        course: 'B. Tech.', sem: '1st', session: '', paperName: '', code: '', date: '', stream: '', time: '', marks: '', exam: ''
    });

    // Mock Test State
    const [isMockTestModalOpen, setIsMockTestModalOpen] = useState(false);
    const [mockEnabledTopics, setMockEnabledTopics] = useState<string[]>([]);
    const [mockConfigLoading, setMockConfigLoading] = useState(false);
    const [currentFacultyName, setCurrentFacultyName] = useState('');

    // Derived Lists
    const topics = Array.from(new Set(questions.map(q => q.topic))).sort();
    const subtopics = Array.from(new Set(questions.map(q => q.subtopic))).sort();

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            const parsed = JSON.parse(user);
            setUserEmail(parsed.email);
            setUserName(parsed.name);
            fetchQuestions(parsed.email);
        }
    }, []);

    const fetchQuestions = async (email: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                headers: { 'X-User-Email': email }
            });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
                if (data.length > 0) setCurrentFacultyName(data[0].facultyName);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Mock Test Logic ---
    const openMockTestModal = async () => {
        setIsMockTestModalOpen(true);
        setMockConfigLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;

            if (!user || !user.email) {
                toast.error('User email not found');
                return;
            }

            const res = await fetch('/api/admin/mock-test-config', {
                headers: { 'X-User-Email': user.email }
            });

            if (res.ok) {
                const data = await res.json();
                setMockEnabledTopics(data.enabledTopics || []);
                // If we got facultyName from API, use it, otherwise fall back to what we have
                if (data.facultyName) setCurrentFacultyName(data.facultyName);
            }
        } catch (error) {
            toast.error('Error loading config');
        } finally {
            setMockConfigLoading(false);
        }
    };

    const toggleMockTopic = (topic: string) => {
        setMockEnabledTopics(prev => {
            if (prev.includes(topic)) return prev.filter(t => t !== topic);
            return [...prev, topic];
        });
    };

    const saveMockSettings = async () => {
        // If we don't have facultyName yet, we can't save effectively for the student side unless we guess.
        // We'll use the one we have in state.
        if (!currentFacultyName && userName) setCurrentFacultyName(userName);

        setMockConfigLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;
            if (!user || !user.email) return;

            const res = await fetch('/api/admin/mock-test-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                body: JSON.stringify({
                    facultyName: currentFacultyName || userName, // Fallback
                    enabledTopics: mockEnabledTopics
                })
            });

            if (res.ok) {
                toast.success('Mock test settings saved!');
                setIsMockTestModalOpen(false);
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            toast.error('Error saving settings');
        } finally {
            setMockConfigLoading(false);
        }
    };

    // --- Editor Logic ---
    const handleManualChange = (field: string, value: string) => {
        setManualData(prev => ({ ...prev, [field]: value }));
        setPreviewContent([{
            ...manualData,
            id: manualData.id || 'preview',
            [field]: value,
            facultyName: userName
        }]);
    };

    const normalizeImportedData = (data: any[]) => {
        return data.map((q: any) => {
            let text = q.text;
            if (!text && q.content) text = q.content;
            let type = q.type;
            let id = q.id;
            if (!type && ['broad', 'mcq', 'blanks'].includes(q.id)) {
                type = q.id;
                id = null;
            }
            return {
                ...q,
                id: id,
                text: text || '',
                type: type || 'broad',
                facultyName: userName
            };
        });
    };

    const checkForDuplicates = (imported: any[]) => {
        const duplicates: any[] = [];
        const unique: any[] = [];
        imported.forEach(newQ => {
            const exists = questions.find(existing => existing.text.trim() === newQ.text.trim());
            if (exists) duplicates.push({ new: newQ, existing: exists });
            else unique.push(newQ);
        });

        if (duplicates.length > 0) {
            setDuplicateQuestions(duplicates);
            setNewQuestions(unique);
            setIsDuplicateModalOpen(true);
        } else {
            setPreviewContent(imported);
        }
    };

    const handleJsonInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setJsonContent(val);
        try {
            const parsed = JSON.parse(val);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const normalized = normalizeImportedData(arr);
            checkForDuplicates(normalized);
            setJsonError(null);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonContent(content);
            try {
                const parsed = JSON.parse(content);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                const normalized = normalizeImportedData(arr);
                checkForDuplicates(normalized);
                setJsonError(null);
            } catch (e) {
                setJsonError("Invalid JSON file");
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    const resolveDuplicates = (action: 'overwrite' | 'keep') => {
        let finalContent = [...newQuestions];
        if (action === 'overwrite') {
            const updates = duplicateQuestions.map(d => ({
                ...d.new,
                id: d.existing.id
            }));
            finalContent = [...finalContent, ...updates];
        } else {
            const news = duplicateQuestions.map(d => ({
                ...d.new,
                id: null
            }));
            finalContent = [...finalContent, ...news];
        }
        setPreviewContent(finalContent);
        setIsDuplicateModalOpen(false);
        setDuplicateQuestions([]);
        setNewQuestions([]);
    };

    const syncEditorCursor = (questionText: string) => {
        if (!textAreaRef.current || !jsonContent || !questionText) return;
        const snippet = questionText.substring(0, 20);
        const index = jsonContent.indexOf(snippet);
        if (index !== -1) {
            textAreaRef.current.focus();
            textAreaRef.current.setSelectionRange(index, index);
            const lineHeight = 20;
            const lines = jsonContent.substring(0, index).split('\n').length;
            textAreaRef.current.scrollTop = lines * lineHeight - 100;
        }
    };

    const copyPrompt = () => {
        navigator.clipboard.writeText(AI_PROMPT);
        alert("Prompt copied to clipboard!");
    };

    const saveToDatabase = async () => {
        if (previewContent.length === 0) return;
        const invalid = previewContent.find(q => !q.topic || !q.subtopic || !q.text);
        if (invalid) {
            alert('All questions must have a Topic, Subtopic, and Text.');
            return;
        }

        setLoading(true);
        try {
            const toSave = previewContent.map(q => ({
                ...q,
                id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                topic: q.topic.charAt(0).toUpperCase() + q.topic.slice(1),
                subtopic: q.subtopic.charAt(0).toUpperCase() + q.subtopic.slice(1),
                type: q.type || 'broad'
            }));

            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail || ''
                },
                body: JSON.stringify({ questions: toSave })
            });

            if (res.ok) {
                toast.success('Saved successfully!');
                setIsEditorOpen(false);
                setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
                setJsonContent('');
                setPreviewContent([]);
                if (userEmail) fetchQuestions(userEmail);
            } else {
                toast.error('Failed to save.');
            }
        } catch (error) {
            toast.error('Error saving questions.');
        } finally {
            setLoading(false);
        }
    };

    // --- Viewer Logic ---
    const filteredQuestions = questions.filter(q => {
        const tMatch = selectedTopics.length === 0 || selectedTopics.includes(q.topic);
        const sMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);
        return tMatch && sMatch;
    });

    const toggleSelectAll = () => {
        if (selectedQuestionIds.size === filteredQuestions.length) {
            setSelectedQuestionIds(new Set());
        } else {
            setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedQuestionIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedQuestionIds(newSet);
    };

    const deleteSelected = async () => {
        if (selectedQuestionIds.size === 0) return;
        if (!confirm(`Delete ${selectedQuestionIds.size} questions?`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/questions', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail || ''
                },
                body: JSON.stringify({ ids: Array.from(selectedQuestionIds) })
            });

            if (res.ok) {
                setSelectedQuestionIds(new Set());
                if (userEmail) fetchQuestions(userEmail);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const downloadJson = () => {
        const data = filteredQuestions.filter(q => selectedQuestionIds.size === 0 || selectedQuestionIds.has(q.id));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'questions.json';
        a.click();
    };

    const handleModeSwitch = (mode: 'manual' | 'json' | 'pdf') => {
        setEditorMode(mode);
        setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
        setJsonContent('');
        setPreviewContent([]);
        setJsonError(null);
        setIsEditorOpen(true);
    };

    const editQuestion = (q: any) => {
        setManualData({
            id: q.id,
            type: q.type,
            topic: q.topic,
            subtopic: q.subtopic,
            text: q.text
        });
        setPreviewContent([{ ...q, facultyName: userName }]);
        setEditorMode('manual');
        setIsEditorOpen(true);
    };

    const downloadPdf = () => {
        const selectedQs = questions.filter(q => selectedQuestionIds.has(q.id));
        if (selectedQs.length === 0) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Selected Questions</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .q-item { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .meta { font-size: 10pt; color: #666; margin-bottom: 5px; font-style: italic; }
                    @media print { 
                        body { padding: 20px; } 
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${selectedQs.map((q, i) => `
                    <div class="q-item">
                        <div class="meta">${q.topic} / ${q.subtopic} (${q.type})</div>
                        <div><b>Q${i + 1}.</b> ${q.text}</div>
                    </div>
                `).join('')}
                
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
                <script>
                    function triggerPrint() {
                        if (window.renderMathInElement) {
                            try {
                                renderMathInElement(document.body, {
                                    delimiters: [
                                        {left: '$$', right: '$$', display: true},
                                        {left: '$', right: '$', display: false},
                                        {left: '\\\\(', right: '\\\\)', display: false},
                                        {left: '\\\\[', right: '\\\\]', display: true}
                                    ],
                                    throwOnError: false
                                });
                            } catch (e) { console.error(e); }
                            setTimeout(() => window.print(), 1000);
                        } else {
                            setTimeout(triggerPrint, 500);
                        }
                    }
                    triggerPrint();
                </script>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    // --- Paper Generator Logic ---
    const generatePreview = () => {
        const selectedQs = questions.filter(q => selectedQuestionIds.has(q.id));
        setPaperQuestions(selectedQs);

        const paperStructure = {
            header: paperConfig,
            questions: selectedQs.map((q, i) => ({
                number: i + 1,
                text: q.text,
                marks: q.type === 'mcq' ? 1 : q.type === 'broad' ? 5 : 2,
                type: q.type
            }))
        };
        setPaperJson(JSON.stringify(paperStructure, null, 2));
        updatePaperHtml(paperStructure);
        setPaperStep(2);
    };

    const updatePaperHtml = (structure: any) => {
        const { header, questions } = structure;
        const html = `
            <html>
            <head>
                <title>Question Paper</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white; }
                    .main-title { text-align: center; font-weight: bold; font-size: 20pt; text-transform: uppercase; margin-bottom: 20px; }
                    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; align-items: start; font-size: 12pt; font-weight: bold; }
                    .header-row { display: flex; justify-content: space-between; }
                    .title { text-align: center; font-weight: bold; font-size: 16pt; text-transform: uppercase; margin-top: 10px; margin-bottom: 5px; }
                    .subtitle { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 20px; }
                    .q-item { margin-bottom: 15px; font-size: 12pt; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="main-title">Heritage Institute of Technology</div>
                <div class="header-grid">
                    <div>${header.course} (${header.sem})</div>
                    <div style="text-align:right">Time: ${header.time}</div>
                    <div>Stream: ${header.stream}</div>
                    <div style="text-align:right">Full Marks: ${header.marks}</div>
                    <div>Session: ${header.session}</div>
                    <div style="text-align:right">Exam: ${header.exam} (${header.date})</div>
                </div>
                <div class="title">${header.paperName}</div>
                <div class="subtitle">Paper Code: ${header.code}</div>
                <hr style="border-top: 2px solid black; margin-bottom: 30px;" />
                <div>
                    ${questions.map((q: any) => `
                        <div class="q-item">
                            <b>Q${q.number}.</b> ${q.text} 
                            <span style="float:right; font-weight:bold">[${q.marks}]</span>
                        </div>
                    `).join('')}
                </div>
                <script>
                    document.addEventListener("DOMContentLoaded", function() {
                        renderMathInElement(document.body, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false},
                                {left: '\\\\(', right: '\\\\)', display: false},
                                {left: '\\\\[', right: '\\\\]', display: true}
                            ],
                            throwOnError: false
                        });
                    });
                </script>
            </body>
            </html>
        `;
        setPaperHtml(html);
    };

    const handlePaperJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPaperJson(val);
        try {
            const parsed = JSON.parse(val);
            updatePaperHtml(parsed);
        } catch (e) {
            // Invalid JSON
        }
    };

    const printPaper = () => {
        const iframe = document.getElementById('paper-preview-frame') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.print();
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
            <datalist id="topics-list">
                {topics.map(t => <option key={t} value={t} />)}
            </datalist>
            <datalist id="subtopics-list">
                {subtopics.map(t => <option key={t} value={t} />)}
            </datalist>

            {/* Header Buttons */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                {/* Left Side Buttons */}
                <div className="flex gap-2 flex-wrap w-full md:w-auto">
                    <button onClick={() => handleModeSwitch('manual')} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        <Plus className="h-3 w-3 md:h-4 md:w-4" /> Latex
                    </button>
                    <button onClick={() => handleModeSwitch('json')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        <Plus className="h-3 w-3 md:h-4 md:w-4" /> JSON
                    </button>
                    <button onClick={() => handleModeSwitch('pdf')} className="bg-purple-600 hover:bg-purple-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        <Plus className="h-3 w-3 md:h-4 md:w-4" /> PDF
                    </button>
                </div>

                {/* Right Side Buttons */}
                <div className="flex gap-2 flex-wrap w-full md:w-auto justify-end">
                    <button onClick={openMockTestModal} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        <GraduationCap className="h-3 w-3 md:h-4 md:w-4" /> Enable Mock Test
                    </button>
                    <button onClick={() => { setPaperStep(0); setPaperQuestions([]); setIsPaperModalOpen(true); }} className="bg-orange-600 hover:bg-orange-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        <ArrowRightCircle className="h-3 w-3 md:h-4 md:w-4" /> Generate Question Paper
                    </button>
                </div>
            </div>

            {/* Mock Test Modal */}
            {isMockTestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-indigo-400" /> Enable Mock Test
                            </h3>
                            <button onClick={() => setIsMockTestModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-sm text-gray-400 mb-4">
                                Select the topics you want to enable for student mock tests. Students will only see questions from enabled topics.
                            </p>

                            {mockConfigLoading ? (
                                <div className="text-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-2" />
                                    <p className="text-gray-400">Loading Configuration...</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {topics.length === 0 ? (
                                        <p className="text-center py-4 text-gray-400 italic">No topics found. Add questions first.</p>
                                    ) : (
                                        topics.map(topic => (
                                            <div key={topic} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700 hover:bg-gray-700/50 transition-colors">
                                                <span className="text-white font-medium">{topic}</span>
                                                <button
                                                    onClick={() => toggleMockTopic(topic)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mockEnabledTopics.includes(topic) ? 'bg-indigo-600' : 'bg-gray-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mockEnabledTopics.includes(topic) ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end gap-3">
                            <button
                                onClick={() => setIsMockTestModalOpen(false)}
                                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveMockSettings}
                                disabled={mockConfigLoading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {mockConfigLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Paper Modal */}
            {isPaperModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileText className="h-5 w-5 text-orange-500" /> Question Paper Generator
                            </h3>
                            <button onClick={() => setIsPaperModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {paperStep === 0 && (
                                <div className="p-6 overflow-y-auto">
                                    <div className="mb-4 bg-blue-900/20 border border-blue-500/30 p-4 rounded text-blue-200 text-sm">
                                        Use the filters in the main view to select specific questions, or select them from the list below.
                                        Current Selection: <strong>{selectedQuestionIds.size}</strong> questions.
                                    </div>

                                    <div className="space-y-2 mb-4 border border-gray-700 rounded p-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-gray-900/50">
                                        {filteredQuestions.length === 0 ? (
                                            <p className="text-gray-500 text-center py-4 text-xs italic">No questions found matching current filters.</p>
                                        ) : (
                                            filteredQuestions.map(q => (
                                                <div key={q.id} className="flex gap-3 p-3 rounded border border-gray-800 hover:border-gray-600 hover:bg-gray-800/50 transition-all">
                                                    <div className="pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedQuestionIds.has(q.id)}
                                                            onChange={() => toggleSelection(q.id)}
                                                            className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex gap-2 mb-1">
                                                            <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded uppercase font-bold">{q.topic}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type === 'broad' ? 'border-pink-500 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>{q.type}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-300 line-clamp-3">
                                                            <Latex>{q.text}</Latex>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <button
                                            onClick={() => {
                                                if (selectedQuestionIds.size === 0) {
                                                    toast.error('Please select at least one question');
                                                    return;
                                                }
                                                setPaperStep(1);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold"
                                        >
                                            Next: Paper Details
                                        </button>
                                    </div>
                                </div>
                            )}

                            {paperStep === 1 && (
                                <div className="p-6 overflow-y-auto">
                                    <h4 className="text-lg font-bold text-white mb-4">Paper Details</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div><label className="block text-xs text-gray-400 mb-1">Paper Name</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.paperName} onChange={e => setPaperConfig({ ...paperConfig, paperName: e.target.value })} placeholder="e.g. End Semester Examination" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Paper Code</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.code} onChange={e => setPaperConfig({ ...paperConfig, code: e.target.value })} placeholder="e.g. HMTS-101" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Course</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.course} onChange={e => setPaperConfig({ ...paperConfig, course: e.target.value })} /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Semester</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.sem} onChange={e => setPaperConfig({ ...paperConfig, sem: e.target.value })} /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Stream/Dept</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.stream} onChange={e => setPaperConfig({ ...paperConfig, stream: e.target.value })} placeholder="e.g. CSE / ECE" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Session</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.session} onChange={e => setPaperConfig({ ...paperConfig, session: e.target.value })} placeholder="e.g. 2024-2025" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Exam Type</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.exam} onChange={e => setPaperConfig({ ...paperConfig, exam: e.target.value })} placeholder="e.g. Mid Term" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Date</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" type="date" value={paperConfig.date} onChange={e => setPaperConfig({ ...paperConfig, date: e.target.value })} /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Time</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.time} onChange={e => setPaperConfig({ ...paperConfig, time: e.target.value })} placeholder="e.g. 3 Hours" /></div>
                                        <div><label className="block text-xs text-gray-400 mb-1">Full Marks</label><input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={paperConfig.marks} onChange={e => setPaperConfig({ ...paperConfig, marks: e.target.value })} placeholder="e.g. 70" /></div>
                                    </div>
                                    <div className="flex justify-between mt-4">
                                        <button onClick={() => setPaperStep(0)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded">Back</button>
                                        <button onClick={generatePreview} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold">Generate Preview</button>
                                    </div>
                                </div>
                            )}

                            {paperStep === 2 && (
                                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                                    <div className="w-full md:w-1/2 p-4 border-r border-gray-700 flex flex-col">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs text-gray-400">JSON Structure (Editable)</label>
                                            <button onClick={printPaper} className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1"><Printer className="h-3 w-3" /> Print / Save PDF</button>
                                        </div>
                                        <textarea
                                            className="flex-1 bg-gray-900 p-2 text-green-400 font-mono text-xs rounded border border-gray-700 resize-none header-json"
                                            value={paperJson}
                                            onChange={handlePaperJsonChange}
                                        />
                                    </div>
                                    <div className="w-full md:w-1/2 bg-gray-500 overflow-hidden relative">
                                        <iframe
                                            id="paper-preview-frame"
                                            srcDoc={paperHtml}
                                            className="w-full h-full bg-white"
                                            title="Paper Preview"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Editor Panel */}
            {isEditorOpen && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col transition-all duration-300">
                    <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white capitalize">{editorMode} Editor</h3>
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 uppercase tracking-wider">Mode</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditorOpen(false)} className="text-gray-400 hover:text-white px-3 flex items-center gap-2 text-sm font-medium">
                                <ArrowLeft className="h-4 w-4" /> Back to Homepage
                            </button>
                            <button onClick={saveToDatabase} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded font-bold flex items-center gap-2">
                                <Save className="h-4 w-4" /> Save
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
                        <div className="p-4 border-r border-gray-700 flex flex-col gap-4 bg-gray-900">
                            {editorMode === 'manual' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Type</label>
                                            <select className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" value={manualData.type} onChange={e => handleManualChange('type', e.target.value)}>
                                                <option value="broad">Broad</option><option value="mcq">MCQ</option><option value="blanks">Blanks</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Topic</label>
                                            <input className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" list="topics-list" placeholder="Select or Type" value={manualData.topic} onChange={e => handleManualChange('topic', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Subtopic</label>
                                            <input className="w-full bg-gray-800 border border-gray-600 text-white rounded p-2 text-sm" list="subtopics-list" placeholder="Select or Type" value={manualData.subtopic} onChange={e => handleManualChange('subtopic', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Question Text (LaTeX supported)</label>
                                        <textarea
                                            className="w-full h-64 bg-gray-800 border border-gray-600 text-green-400 font-mono p-4 rounded focus:outline-none focus:border-blue-500"
                                            placeholder="Type question here... Use $...$ for inline math."
                                            value={manualData.text}
                                            onChange={e => handleManualChange('text', e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            {(editorMode === 'json' || editorMode === 'pdf') && (
                                <div className="flex flex-col h-full gap-4">
                                    {editorMode === 'pdf' && (
                                        <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg space-y-4">
                                            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">1</div>
                                                <span>Copy Prompt & Open AI Tool</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={copyPrompt} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 border border-gray-600">
                                                    <Copy className="h-3 w-3" /> Copy Prompt
                                                </button>
                                                <a href="https://gemini.google.com/app" target="_blank" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                    Gemini <ExternalLink className="h-3 w-3" />
                                                </a>
                                                <a href="https://chatgpt.com/" target="_blank" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                    ChatGPT <ExternalLink className="h-3 w-3" />
                                                </a>
                                                <a href="https://www.perplexity.ai/" target="_blank" className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black py-2 rounded text-xs font-bold flex items-center justify-center gap-1">
                                                    Perplexity <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">2</div>
                                                <span>Paste Generated JSON Below</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs cursor-pointer flex items-center gap-2">
                                            <Upload className="h-3 w-3" /> Import JSON File
                                            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                        <span className="text-xs text-gray-500">or paste text below</span>
                                    </div>

                                    <textarea
                                        ref={textAreaRef}
                                        className="flex-1 bg-gray-800 border border-gray-600 text-green-400 font-mono p-4 rounded focus:outline-none focus:border-blue-500 text-sm leading-relaxed"
                                        placeholder={editorMode === 'json' ? "Paste JSON array here..." : "Paste AI-generated JSON here..."}
                                        value={jsonContent}
                                        onChange={handleJsonInput}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col bg-gray-100 h-full">
                            <div className="bg-gray-200 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
                                <h4 className="text-xs font-bold text-gray-600 uppercase">Live Preview</h4>
                                <span className="text-xs text-gray-500">Click item to edit source</span>
                            </div>
                            {jsonError && (
                                <div className="bg-red-100 border-b border-red-200 p-2 text-xs text-red-600 font-mono break-all">
                                    {jsonError}
                                </div>
                            )}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                {previewContent.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-10 italic">Preview will appear here...</div>
                                ) : (
                                    previewContent.map((q, i) => (
                                        <div
                                            key={i}
                                            onClick={() => syncEditorCursor(q.text)}
                                            className="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors group"
                                        >
                                            <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                                                <div className="flex gap-2">
                                                    <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{q.topic}</span>
                                                    <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{q.subtopic}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">{q.type}</span>
                                            </div>
                                            <div className="text-gray-800 text-sm">
                                                {q.text ? <Latex>{q.text}</Latex> : <span className="text-gray-400 italic">(No text content)</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Viewer Panel */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex-1 flex flex-col shadow-lg">
                <div className="sticky top-0 z-20 bg-gray-800 pb-4 pt-2 -mt-2 flex flex-col md:flex-row gap-4 justify-between items-end border-b border-gray-700 mb-4">
                    <div className="flex gap-4 w-full md:w-auto items-end">
                        <div className="flex items-center h-[38px] px-2">
                            <input
                                type="checkbox"
                                checked={filteredQuestions.length > 0 && selectedQuestionIds.size === filteredQuestions.length}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                title="Select All"
                            />
                        </div>
                        <div className="w-48">
                            <label className="text-xs text-gray-400 mb-1 block">Filter Topic</label>
                            <MultiSelect
                                options={topics}
                                selected={selectedTopics}
                                onChange={setSelectedTopics}
                                placeholder="All Topics"
                            />
                        </div>
                        <div className="w-48">
                            <label className="text-xs text-gray-400 mb-1 block">Filter Subtopic</label>
                            <MultiSelect
                                options={subtopics}
                                selected={selectedSubtopics}
                                onChange={setSelectedSubtopics}
                                placeholder="All Subtopics"
                            />
                        </div>
                    </div>

                    {/* Floating Action Buttons (Sticky) */}
                    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 md:static md:flex-row md:z-0">
                        <button onClick={downloadPdf} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-full md:rounded-md shadow-lg md:shadow-none text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap">
                            <Printer className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Print Selected</span>
                        </button>
                        <button onClick={downloadJson} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-full md:rounded-md shadow-lg md:shadow-none text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap">
                            <Download className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Export JSON</span>
                        </button>
                        <button onClick={deleteSelected} disabled={selectedQuestionIds.size === 0} className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-full md:rounded-md shadow-lg md:shadow-none text-xs md:text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-12 h-12 md:w-auto md:h-auto whitespace-nowrap">
                            <Trash2 className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Delete ({selectedQuestionIds.size})</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading...
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-500 italic">
                            No questions found.
                        </div>
                    ) : (
                        filteredQuestions.map((q) => (
                            <div key={q.id} className={`p-4 rounded border ${selectedQuestionIds.has(q.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-700'} hover:border-gray-500 transition-colors group`}>
                                <div className="flex gap-3">
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedQuestionIds.has(q.id)}
                                            onChange={() => toggleSelection(q.id)}
                                            className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1 cursor-pointer" onClick={() => editQuestion(q)}>
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex gap-2 mb-1">
                                                <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{q.topic}</span>
                                                <span className="bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{q.subtopic}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${q.type === 'broad' ? 'border-pink-500 text-pink-400' : q.type === 'mcq' ? 'border-yellow-500 text-yellow-400' : 'border-cyan-500 text-cyan-400'}`}>
                                                    {q.type}
                                                </span>
                                            </div>
                                            <Edit className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="text-gray-300 text-sm leading-relaxed">
                                            <Latex>{q.text}</Latex>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Duplicate Modal */}
            {isDuplicateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full border border-gray-700 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-yellow-500" /> Duplicates Detected
                        </h3>
                        <p className="text-gray-400 mb-4">Found {duplicateQuestions.length} duplicates. How should we handle them?</p>

                        <div className="max-h-60 overflow-y-auto mb-6 space-y-2">
                            {duplicateQuestions.map((d, i) => (
                                <div key={i} className="p-3 bg-gray-900 rounded border border-gray-700 text-xs">
                                    <div className="text-red-400 font-bold mb-1">Duplicate #{i + 1}</div>
                                    <div className="text-gray-300 mb-1">{d.new.text.substring(0, 100)}...</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 justify-end">
                            <button onClick={() => resolveDuplicates('keep')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium">
                                Keep Both (Create New)
                            </button>
                            <button onClick={() => resolveDuplicates('overwrite')} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded font-medium">
                                Overwrite Existing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
