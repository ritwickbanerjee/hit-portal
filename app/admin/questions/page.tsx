'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Plus, FileJson, FileText, Trash2, Download, Save, X, Printer, Edit, Upload, Copy, ExternalLink, RefreshCw, Check, ChevronDown, ToggleLeft, ToggleRight, GraduationCap, ArrowLeft, ArrowRightCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import 'katex/dist/katex.min.css';
import 'katex/dist/katex.min.css';
import Link from 'next/link';
import QuestionRow from './components/QuestionRow';
import Latex from 'react-latex-next';
import LineNumberTextarea from '../components/LineNumberTextarea';
import TokenUsageIndicator from './components/TokenUsageIndicator';
import FileUploadZone from './components/FileUploadZone';
import ExtractionProgress from './components/ExtractionProgress';
import AutoDebugger from './components/AutoDebugger';
import { AlertCircle } from 'lucide-react';

// --- MultiSelect Component ---
const MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search when closing
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

    // Filter options based on search term
    const filteredOptions = options.filter((opt: string) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-60 overflow-hidden flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                        <input
                            type="text"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 text-gray-300 px-2 py-1 rounded text-xs focus:outline-none focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Clear Selection Option */}
                    {selected.length > 0 && (
                        <div
                            className="px-3 py-2 hover:bg-red-900/30 cursor-pointer flex items-center gap-2 text-xs text-red-400 border-b border-gray-700 sticky top-[42px] bg-gray-800 z-10"
                            onClick={() => onChange([])}
                        >
                            <X className="h-3 w-3" /> Clear Selection
                        </div>
                    )}

                    {/* Options List */}
                    <div className="overflow-y-auto max-h-48">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500 italic">No matches found</div>
                        ) : (
                            filteredOptions.map((opt: string) => (
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
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AI_PROMPT = `You are a Question Bank Assistant. Your task is to extract questions from the provided content and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each question object must have: "text" (string), "type" (string: "broad", "mcq", or "blanks"), "topic" (string), "subtopic" (string).
3. Preserve LaTeX math notation using $ for inline and $$ for display math.
4. IF THE CONTENT CONTAINS IMAGES (diagrams, circuits, graphs):
   - Extract the image and convert it to a Base64 string.
   - Add an "image" field to the JSON object with the Base64 string (e.g., "data:image/png;base64,...").
   - If no image is present for a question, omit the "image" field or set it to null.
5. Do NOT add any explanation, markdown formatting, or extra text. Output ONLY the JSON array.
6. Ensure all special characters are properly escaped in JSON strings.

Example Output:
[
  {
    "text": "Find the rank of the matrix $ A = \\\\begin{pmatrix} 1 & 2 \\\\\\\\ 3 & 4 \\\\end{pmatrix} $",
    "type": "broad",
    "topic": "Matrix",
    "subtopic": "Rank",
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
  }
]
`;

type EditorMode = 'manual' | 'json' | 'image' | 'pdf' | 'latex';

export default function QuestionBank() {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<EditorMode>('manual');
    const [manualData, setManualData] = useState({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
    const [jsonContent, setJsonContent] = useState('');
    const [previewContent, setPreviewContent] = useState<any[]>([]);
    const [jsonError, setJsonError] = useState<string | null>(null);

    const [errorLine, setErrorLine] = useState<number | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const lastEditedId = useRef<string | null>(null);

    // AI Extraction State
    const [quotaExhausted, setQuotaExhausted] = useState(false);
    const [isAiExtracting, setIsAiExtracting] = useState(false);
    const [extractionStage, setExtractionStage] = useState<'idle' | 'initializing' | 'processing' | 'analyzing' | 'extracting' | 'parsing' | 'validating' | 'complete' | 'error'>('idle');
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [extractionError, setExtractionError] = useState<string | null>(null);
    const [validationIssues, setValidationIssues] = useState<any[]>([]);
    const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0);



    // Duplicate Detection State
    const [duplicateQuestions, setDuplicateQuestions] = useState<any[]>([]);
    const [newQuestions, setNewQuestions] = useState<any[]>([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    // Filter State
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    // Singular Selection for Modal
    const [selectedTopic, setSelectedTopic] = useState('');
    const [selectedSubtopic, setSelectedSubtopic] = useState('');

    const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

    // Paper Generator State
    const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
    const [paperStep, setPaperStep] = useState(0); // 0: Select, 1: Details, 2: Preview
    const [paperQuestions, setPaperQuestions] = useState<any[]>([]);
    const [paperHtml, setPaperHtml] = useState('');
    const [paperJson, setPaperJson] = useState('');
    const [paperPreviewKey, setPaperPreviewKey] = useState(0);
    const [paperConfig, setPaperConfig] = useState({
        course: 'B. Tech.', sem: '1st', session: '', paperName: '', code: '', date: '', stream: '', time: '', marks: '', exam: ''
    });

    // Mock Test State
    const [isMockTestModalOpen, setIsMockTestModalOpen] = useState(false);
    const [mockTopicConfigs, setMockTopicConfigs] = useState<any[]>([]);
    const [mockConfigLoading, setMockConfigLoading] = useState(false);
    const [currentFacultyName, setCurrentFacultyName] = useState('');
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

    // Dropdowns for deployments - dynamically loaded from students
    const [availableDepts, setAvailableDepts] = useState<string[]>([]);
    const [availableYears, setAvailableYears] = useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = useState<string[]>([]);

    // Derived Lists
    const topics = Array.from(new Set(questions.map(q => q.topic))).sort();

    // Cascading Subtopics: Filter based on selected topics
    const subtopics = useMemo(() => {
        const filteredByTopic = selectedTopics.length > 0
            ? questions.filter(q => selectedTopics.includes(q.topic))
            : questions;
        return Array.from(new Set(filteredByTopic.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopics]);

    // Paper Modal Subtopics
    const paperSubtopics = useMemo(() => {
        const filteredByTopic = selectedTopic
            ? questions.filter(q => q.topic === selectedTopic)
            : questions;
        return Array.from(new Set(filteredByTopic.map(q => q.subtopic))).filter(Boolean).sort();
    }, [questions, selectedTopic]);

    // Compute filtered questions based on selected topics and subtopics
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            const topicMatch = selectedTopics.length === 0 || selectedTopics.includes(q.topic);
            const subtopicMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);
            return topicMatch && subtopicMatch;
        });
    }, [questions, selectedTopics, selectedSubtopics]);

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
            // Fetch questions and students in parallel
            const [questionsRes, studentsRes] = await Promise.all([
                fetch('/api/admin/questions', { headers: { 'X-User-Email': email } }),
                fetch('/api/admin/students/all').catch(() => null)
            ]);

            if (questionsRes.ok) {
                const data = await questionsRes.json();
                setQuestions(data);
                if (data.length > 0) setCurrentFacultyName(data[0].facultyName);
            }

            // Extract unique departments, years, and courses from students
            if (studentsRes && studentsRes.ok) {
                const students = await studentsRes.json();
                const depts = Array.from(new Set(students.map((s: any) => s.department).filter(Boolean)));
                const years = Array.from(new Set(students.map((s: any) => s.year).filter(Boolean)));
                const courses = Array.from(new Set(students.map((s: any) => s.course_code).filter(Boolean)));

                console.log('[QUESTIONS] Loaded dropdowns - Depts:', depts, 'Years:', years, 'Courses:', courses);

                // Update dropdown state (we need to  add these state variables)
                setAvailableDepts(depts as string[]);
                setAvailableYears(years as string[]);
                setAvailableCourses(courses as string[]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- Mock Test Logic ---
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

            const headers: any = { 'X-User-Email': user.email };
            if (typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') {
                headers['X-Global-Admin-Key'] = 'globaladmin_25';
            }

            const res = await fetch('/api/admin/mock-test-config', { headers });
            let data: any[] = [];
            if (res.ok) {
                const responseData = await res.json();
                console.log('[MOCK TEST LOAD] Loaded config:', responseData);
                // API returns { facultyName, topics: [] }
                // Use default empty array if topics is undefined
                data = responseData.topics || [];
            }

            // Get all unique topics from loaded questions
            const uniqueTopics = Array.from(new Set(questions.map((q: any) => q.topic))).filter(Boolean).sort();

            const allTopicsConfigs = uniqueTopics.map((topicName: any) => {
                const existing = data.find((d: any) => d.topic === topicName);
                if (existing) return existing;
                return {
                    topic: topicName,
                    enabled: false,
                    deployments: []
                };
            });

            setMockTopicConfigs(allTopicsConfigs);
        } catch (error) {
            console.error(error);
            toast.error('Error loading config');
        } finally {
            setMockConfigLoading(false);
        }
    };

    const toggleTopicEnabled = (topic: string) => {
        setMockTopicConfigs(prev => {
            const existing = prev.find(t => t.topic === topic);
            if (existing) {
                const newEnabled = !existing.enabled;
                // Auto-expand when enabling
                if (newEnabled) {
                    setExpandedTopics(prevExpanded => {
                        const next = new Set(prevExpanded);
                        next.add(topic);
                        return next;
                    });
                }
                return prev.map(t =>
                    t.topic === topic ? { ...t, enabled: newEnabled } : t
                );
            } else {
                // New topic, enable and expand
                setExpandedTopics(prevExpanded => {
                    const next = new Set(prevExpanded);
                    next.add(topic);
                    return next;
                });
                return [...prev, { topic, enabled: true, deployments: [] }];
            }
        });
    };

    const addDeployment = (topic: string) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? { ...t, deployments: [...(t.deployments || []), { department: '', year: '', course: '' }] }
                : t
        ));
    };

    const updateDeployment = (topic: string, index: number, field: string, value: string) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? {
                    ...t,
                    deployments: t.deployments.map((d: any, i: number) =>
                        i === index ? { ...d, [field]: value } : d
                    )
                }
                : t
        ));
    };

    const removeDeployment = (topic: string, index: number) => {
        setMockTopicConfigs(prev => prev.map(t =>
            t.topic === topic
                ? { ...t, deployments: t.deployments.filter((_: any, i: number) => i !== index) }
                : t
        ));
    };

    const saveMockSettings = async () => {
        // If we don't have facultyName yet, we can't save effectively for the student side unless we guess.
        // We'll use the one we have in state.
        if (!currentFacultyName && userName) setCurrentFacultyName(userName);

        // Validation: Check if any enabled topic has incomplete deployments
        const enabledTopics = mockTopicConfigs.filter(t => t.enabled);
        for (const topicConfig of enabledTopics) {
            if (!topicConfig.deployments || topicConfig.deployments.length === 0) {
                toast.error(`Topic "${topicConfig.topic}" is enabled but has no deployments. Please add at least one deployment.`);
                return;
            }
            // Check if any deployment has missing fields
            for (const dep of topicConfig.deployments) {
                if (!dep.department || !dep.year || !dep.course) {
                    toast.error(`Topic "${topicConfig.topic}" has incomplete deployment details. Please fill all fields (Department, Year, Course).`);
                    return;
                }
            }
        }

        setMockConfigLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const user = storedUser ? JSON.parse(storedUser) : null;
            if (!user || !user.email) return;

            const finalFacultyName = currentFacultyName || userName;
            console.log('[MOCK TEST SAVE] Saving with faculty name:', finalFacultyName);
            console.log('[MOCK TEST SAVE] Config to save:', mockTopicConfigs);

            const res = await fetch('/api/admin/mock-test-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                body: JSON.stringify({
                    facultyName: finalFacultyName,
                    topics: mockTopicConfigs
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

        if (!val.trim()) {
            setPreviewContent([]);
            setJsonError(null);
            setErrorLine(null);
            return;
        }

        try {
            const parsed = JSON.parse(val);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const normalized = normalizeImportedData(arr);
            checkForDuplicates(normalized);
            setJsonError(null);
            setErrorLine(null);
        } catch (e: any) {
            setJsonError((e as Error).message);
            // Extract line number from error message if possible
            // Chrome/Node syntax: "Unexpected token ... at position X"
            // We can try to calculate line number from position
            const match = e.message.match(/position\s+(\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                const contentUpToError = val.substring(0, pos);
                setErrorLine(contentUpToError.split('\n').length);
            }
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

    // Cursor sync removed - Row based layout handles this naturally

    const handleRowChange = (index: number, updatedQuestion: any) => {
        const newContent = [...previewContent];
        newContent[index] = updatedQuestion;
        setPreviewContent(newContent);
    };

    const handleRowDelete = (index: number) => {
        const newContent = [...previewContent];
        newContent.splice(index, 1);
        setPreviewContent(newContent);
    };

    const handleAddNewQuestion = () => {
        setPreviewContent([...previewContent, {
            id: `q_${Date.now()}`,
            text: "New Question Text",
            type: "broad",
            topic: "Topic",
            subtopic: "Subtopic"
        }]);
        // Auto-scroll removed
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

                // Scroll back to edited question
                if (lastEditedId.current) {
                    const targetId = lastEditedId.current;
                    setTimeout(() => {
                        const el = document.getElementById(`q-${targetId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-2', 'ring-blue-500', 'bg-gray-800');
                            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'bg-gray-800'), 2000);
                        }
                    }, 500); // Wait for list to re-render/visible
                    // We don't clear lastEditedId here immediately to allow the timeout to read it, 
                    // or we capture it in const targetId closure above.
                }
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
    // Filter Questions for Paper Modal
    const paperModalFilteredQuestions = questions.filter((q) => {
        if (!q.topic) return false;
        if (selectedTopic && q.topic !== selectedTopic) return false;
        if (selectedSubtopic && q.subtopic !== selectedSubtopic) return false;
        return true;
    });

    // Reset filters when closing modal
    useEffect(() => {
        if (!isPaperModalOpen) {
            setSelectedTopic('');
            setSelectedSubtopic('');
        }
    }, [isPaperModalOpen]);

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

    const handleModeSwitch = (mode: 'manual' | 'json' | 'pdf' | 'latex' | 'image') => {
        setEditorMode(mode);
        setManualData({ id: '', type: 'broad', topic: '', subtopic: '', text: '' });
        setJsonContent('');
        setJsonError(null);
        setErrorLine(null);
        lastEditedId.current = null;

        if (mode === 'latex' || mode === 'image') {
            // Auto-initialize with one empty question so editor is visible
            setPreviewContent([{
                id: crypto.randomUUID(),
                type: 'broad',
                topic: '',
                subtopic: '',
                text: '',
                image: ''
            }]);
        } else {
            setPreviewContent([]);
        }

        setIsEditorOpen(true);
    };

    // AI Extraction Handlers
    const handleAiExtraction = async (files: File[]) => {
        if (!userEmail || quotaExhausted) {
            toast.error('Cannot extract: quota exhausted');
            return;
        }

        setIsAiExtracting(true);
        setExtractionStage('initializing');
        setExtractionProgress(0);
        setExtractionError(null);
        setValidationIssues([]);

        const allExtractedQuestions: any[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setExtractionStage('processing');
                setExtractionProgress((i / files.length) * 90);

                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/admin/questions/extract', {
                    method: 'POST',
                    headers: {
                        'X-User-Email': userEmail
                    },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Extraction failed');
                }

                const data = await response.json();
                allExtractedQuestions.push(...data.questions);
            }

            setExtractionStage('validating');
            const issues: any[] = [];

            allExtractedQuestions.forEach((q, index) => {
                if (!q.text || !q.type || !q.topic || !q.subtopic) {
                    issues.push({ line: index + 1, message: 'Missing required fields' });
                }
            });

            setValidationIssues(issues);

            const jsonString = JSON.stringify(allExtractedQuestions, null, 2);
            setJsonContent(jsonString);

            const normalized = normalizeImportedData(allExtractedQuestions);
            checkForDuplicates(normalized);

            setExtractionProgress(100);
            setExtractionStage('complete');
            setEditorMode('pdf'); // Keep user in PDF/AI Editor mode
            setIsEditorOpen(true);
            setUsageRefreshTrigger(prev => prev + 1);

            toast.success(`Extracted ${allExtractedQuestions.length} questions!`);

        } catch (error: any) {
            console.error('AI Extraction error:', error);
            setExtractionStage('error');
            setExtractionError(error.message || 'Unknown error occurred');
            toast.error(error.message || 'Extraction failed');
        } finally {
            setIsAiExtracting(false);
        }
    };

    const handleAutoFix = (fixedJSON: string) => {
        setJsonContent(fixedJSON);
        handleJsonInput({ target: { value: fixedJSON } } as any);
    };

    const handleRetryExtraction = () => {
        setExtractionStage('idle');
        setExtractionError(null);
        setValidationIssues([]);
    };


    const editQuestion = (q: any) => {
        // Scroll to top so user can see the editor
        window.scrollTo({ top: 0, behavior: 'smooth' });
        lastEditedId.current = q.id;

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
        setPaperPreviewKey(prev => prev + 1); // Force iframe remount
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
            // Wait a bit to ensure iframe content is fully loaded
            setTimeout(() => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.print();
                } else if (iframe.contentDocument) {
                    iframe.contentDocument.defaultView?.print();
                }
            }, 500);
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
                <div className="flex gap-2 flex-wrap w-full md:w-auto items-center">
                    <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-md text-xs font-bold border border-gray-700">
                        Total: {questions.length}
                    </span>
                    <button onClick={() => handleModeSwitch('latex')} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        Latex
                    </button>
                    <button onClick={() => handleModeSwitch('json')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        JSON
                    </button>
                    <button onClick={() => handleModeSwitch('pdf')} className="bg-purple-600 hover:bg-purple-500 text-white px-2 py-1.5 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium flex items-center gap-2">
                        PDF
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

            {/* Mock Test Modal - Complete Replacement */}
            {
                isMockTestModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                                    Enable topics and configure deployment for specific courses. Students will only see topics deployed to their course/department/year.
                                </p>

                                {mockConfigLoading ? (
                                    <div className="text-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-2" />
                                        <p className="text-gray-400">Loading Configuration...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {topics.length === 0 ? (
                                            <p className="text-center py-4 text-gray-400 italic">No topics found. Add questions first.</p>
                                        ) : (
                                            topics.map(topic => {
                                                const config = mockTopicConfigs.find(t => t.topic === topic) || { topic, enabled: false, deployments: [] };
                                                const isEnabled = config.enabled;
                                                const isExpanded = expandedTopics.has(topic);

                                                return (
                                                    <div key={topic} className="bg-gray-900/50 rounded-lg border border-gray-700">
                                                        <div className="flex items-center justify-between p-3">
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <button
                                                                    onClick={() => toggleTopicEnabled(topic)}
                                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                </button>
                                                                <span className="text-white font-medium">{topic}</span>
                                                                {isEnabled && config.deployments && config.deployments.length > 0 && (
                                                                    <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded">
                                                                        {config.deployments.length} deployment{config.deployments.length !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isEnabled && (
                                                                <button
                                                                    onClick={() => setExpandedTopics(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(topic)) next.delete(topic);
                                                                        else next.add(topic);
                                                                        return next;
                                                                    })}
                                                                    className="text-gray-400 hover:text-white"
                                                                >
                                                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {isEnabled && isExpanded && (
                                                            <div className="px-4 pb-4 border-t border-gray-700 pt-3 space-y-3">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <p className="text-xs text-gray-400">Configure where this topic is deployed:</p>
                                                                    <button
                                                                        onClick={() => addDeployment(topic)}
                                                                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded flex items-center gap-1"
                                                                    >
                                                                        <Plus className="h-3 w-3" /> Add Deployment
                                                                    </button>
                                                                </div>

                                                                {config.deployments && config.deployments.length > 0 ? (
                                                                    config.deployments.map((dep: any, idx: number) => (
                                                                        <div key={idx} className="grid grid-cols-3 gap-2 bg-gray-800 p-3 rounded">
                                                                            <div>
                                                                                <label className="text-xs text-gray-400 mb-1 block">Department</label>
                                                                                <select
                                                                                    value={dep.department}
                                                                                    onChange={(e) => updateDeployment(topic, idx, 'department', e.target.value)}
                                                                                    className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                                                                                >
                                                                                    <option value="">Select...</option>
                                                                                    {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs text-gray-400 mb-1 block">Year</label>
                                                                                <select
                                                                                    value={dep.year}
                                                                                    onChange={(e) => updateDeployment(topic, idx, 'year', e.target.value)}
                                                                                    className="w-full bg-gray-900 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                                                                                >
                                                                                    <option value="">Select...</option>
                                                                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                                                                </select>
                                                                            </div>
                                                                            <div className="relative">
                                                                                <label className="text-xs text-gray-400 mb-1 block">Course</label>
                                                                                <div className="flex gap-1">
                                                                                    <select
                                                                                        value={dep.course}
                                                                                        onChange={(e) => updateDeployment(topic, idx, 'course', e.target.value)}
                                                                                        className="flex-1 bg-gray-900 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                                                                                    >
                                                                                        <option value="">Select...</option>
                                                                                        {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={() => removeDeployment(topic, idx)}
                                                                                        className="text-red-400 hover:text-red-300 px-2"
                                                                                        title="Remove"
                                                                                    >
                                                                                        <X className="h-3 w-3" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-xs text-gray-500 italic text-center py-2">
                                                                        No deployments configured. Click "Add Deployment" to deploy this topic.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
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
                )
            }

            {/* Paper Modal */}
            {isPaperModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-[95vw] h-[95vh] shadow-2xl overflow-hidden flex flex-col relative md:ml-64">
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
                                <>
                                    <div className="mb-4 bg-blue-900/20 border border-blue-500/30 p-4 rounded text-blue-200 text-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                                        <span>Use filters to find questions. Current Selection: <strong>{selectedQuestionIds.size}</strong> questions.</span>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-gray-900 border border-gray-600 text-white text-xs rounded p-1.5"
                                                value={selectedTopic}
                                                onChange={e => setSelectedTopic(e.target.value)}
                                            >
                                                <option value="">All Topics</option>
                                                {topics.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <select
                                                className="bg-gray-900 border border-gray-600 text-white text-xs rounded p-1.5"
                                                value={selectedSubtopic}
                                                onChange={e => setSelectedSubtopic(e.target.value)}
                                                disabled={!selectedTopic}
                                            >
                                                <option value="">All Subtopics</option>
                                                {paperSubtopics.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4 border border-gray-700 rounded p-2 flex-1 overflow-y-auto custom-scrollbar bg-gray-900/50">
                                        {paperModalFilteredQuestions.length === 0 ? (
                                            <p className="text-gray-500 text-center py-4 text-xs italic">No questions found matching current filters.</p>
                                        ) : (
                                            paperModalFilteredQuestions.map(q => (
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
                                </>
                            )}

                            {paperStep === 1 && (
                                <div className="p-6 overflow-y-auto h-full">
                                    <h4 className="text-lg font-bold text-white mb-4">Paper Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

                                    <div className="flex justify-between mt-auto pt-4 border-t border-gray-700">
                                        <button onClick={() => setPaperStep(0)} className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 font-medium">
                                            &larr; Back
                                        </button>
                                        <button onClick={generatePreview} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold flex items-center gap-2">
                                            Preview <FileText className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {paperStep === 2 && (
                                <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
                                    <div className="w-full md:w-1/2 p-4 border-r border-gray-700 flex flex-col h-full bg-gray-900">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs text-gray-400">JSON Structure (Editable)</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPaperStep(1)} className="bg-gray-700 text-white px-3 py-1 rounded text-xs hover:bg-gray-600">Back</button>
                                                <button onClick={printPaper} className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-500"><Printer className="h-3 w-3" /> Print / Save PDF</button>
                                            </div>
                                        </div>
                                        <textarea
                                            className="flex-1 bg-gray-950 p-2 text-green-400 font-mono text-xs rounded border border-gray-700 resize-none header-json focus:outline-none focus:border-blue-500"
                                            value={paperJson}
                                            onChange={handlePaperJsonChange}
                                        />
                                    </div>
                                    <div className="w-full md:w-1/2 bg-gray-500 overflow-hidden relative h-full">
                                        <iframe
                                            id="paper-preview-frame"
                                            key={paperPreviewKey}
                                            srcDoc={paperHtml}
                                            className="w-full h-full bg-white"
                                            title="Paper Preview"
                                            sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox"
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
                            <h3 className="text-lg font-bold text-white">
                                {editorMode === 'latex' ? 'LATEX Editor Mode' :
                                    editorMode === 'json' ? 'JSON Editor Mode' :
                                        editorMode === 'image' ? 'Image Editor Mode' : 'AI Editor'}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 uppercase tracking-wider">{editorMode} Mode</span>
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300 border border-blue-500/30">
                                ({previewContent.length} Questions)
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {editorMode === 'json' && (
                                <label className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium cursor-pointer flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    const content = event.target?.result as string;
                                                    handleJsonInput({ target: { value: content } } as any);
                                                };
                                                reader.readAsText(file);
                                            }
                                        }}
                                    />
                                    Upload JSON
                                </label>
                            )}
                            <button onClick={() => setIsEditorOpen(false)} className="text-gray-400 hover:text-white px-3 flex items-center gap-2 text-sm font-medium">
                                <ArrowLeft className="h-4 w-4" /> Back to Homepage
                            </button>

                        </div>
                    </div>

                    {/* AI Features Section - Full Width Above Split Screen */}
                    {
                        editorMode === 'pdf' && (
                            <div className="bg-gray-900 border-b border-gray-700 p-6 space-y-6">
                                {/* Token Usage Indicator */}
                                {userEmail && !quotaExhausted && (
                                    <TokenUsageIndicator
                                        userEmail={userEmail}
                                        onQuotaExhausted={() => {
                                            setQuotaExhausted(true);
                                            toast.error('Daily API quota exhausted. Use manual entry below.');
                                        }}
                                        refreshTrigger={usageRefreshTrigger}
                                    />
                                )}

                                {/* Quota Exhausted Warning */}
                                {quotaExhausted && (
                                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-red-300 font-bold text-sm mb-1">Daily Quota Exhausted</h4>
                                            <p className="text-red-200/80 text-xs">
                                                Daily API limit reached. Use manual entry below.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* File Upload Zone */}
                                {!quotaExhausted && (
                                    <>
                                        <FileUploadZone
                                            onFilesReady={handleAiExtraction}
                                            maxFiles={5}
                                            disabled={isAiExtracting}
                                        />

                                    </>
                                )}

                                {/* Extraction Progress */}
                                {isAiExtracting && (
                                    <ExtractionProgress
                                        stage={extractionStage}
                                        progress={extractionProgress}
                                        questionsFound={previewContent.length}
                                        error={extractionError || undefined}
                                    />
                                )}

                                {/* Auto Debugger */}
                                {validationIssues.length > 0 && extractionStage === 'complete' && (
                                    <AutoDebugger
                                        jsonContent={jsonContent}
                                        issues={validationIssues}
                                        onAutoFix={handleAutoFix}
                                        onRetry={handleRetryExtraction}
                                    />
                                )}

                                {/* Manual Tool Section */}
                                <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                                        <span>Manual: Use External AI Tool</span>
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
                                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">↓</div>
                                        <span>Paste Generated JSON Below</span>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {
                        jsonError && (
                            <span className="text-red-400 text-xs font-bold bg-red-900/20 px-2 py-1 rounded border border-red-500/20">
                                {jsonError}
                            </span>
                        )
                    }


                    <textarea
                        className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs md:text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-y"
                        placeholder={`[\n  {\n    "text": "Question text...",\n    "type": "broad",\n    "topic": "Math",\n    "subtopic": "Algebra"\n  }\n]`}
                        value={jsonContent}
                        onChange={handleJsonInput}
                        spellCheck={false}
                    />
                </div >
            )
            }

            {/* Row-Based Editor List */}
            {
                isEditorOpen && (
                    <div className="flex flex-col bg-gray-900 border-t border-gray-700">
                        {/* Total Generated Questions Count */}
                        {previewContent.length > 0 && (
                            <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex justify-center">
                                <div className="bg-blue-900/30 border border-blue-500/50 px-4 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                                    <span className="text-blue-200 text-xs uppercase font-bold tracking-wider">Total Generated Questions:</span>
                                    <span className="text-white font-bold text-lg">{previewContent.length}</span>
                                </div>
                            </div>
                        )}

                        {previewContent.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
                                <FileText className="h-12 w-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No questions yet</p>
                                <p className="text-sm mb-6 max-w-md">
                                    {editorMode === 'json' ? 'Paste JSON above or upload a file.' : 'Upload a file above or add a question manually.'}
                                </p>
                                {!['json', 'latex', 'image'].includes(editorMode) && (
                                    <button
                                        onClick={handleAddNewQuestion}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" /> Add First Question
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {previewContent.map((q, i) => (
                                    <QuestionRow
                                        key={q.id || i}
                                        index={i}
                                        question={q}
                                        mode={editorMode}
                                        topics={topics} // Pass props for dropdowns
                                        subtopics={subtopics}
                                        onChange={(updated) => handleRowChange(i, updated)}
                                        onDelete={() => handleRowDelete(i)}
                                    />
                                ))}

                                {!['json', 'latex'].includes(editorMode) && (
                                    <div className="p-8 flex flex-col gap-4 justify-center bg-gray-900 border-t border-gray-700">
                                        <button
                                            onClick={handleAddNewQuestion}
                                            className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors w-full max-w-md mx-auto justify-center"
                                        >
                                            <Plus className="h-5 w-5" /> Add New Question
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }



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
                        {/* Filtered Count Box */}
                        <div className="flex flex-col justify-end">
                            <label className="text-xs text-gray-400 mb-1 block opacity-0">Count</label>
                            <div className="h-[38px] px-3 bg-blue-900/30 border border-blue-500/30 rounded flex items-center justify-center min-w-[60px]">
                                <span className="text-blue-300 font-bold text-sm">{filteredQuestions.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Floating Action Buttons (Always Floating) */}
                    {/* Floating Action Buttons */}
                    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                        {!isEditorOpen ? (
                            <>
                                <button onClick={downloadPdf} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                    <Printer className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Print Selected</span>
                                </button>
                                <button onClick={downloadJson} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                    <Download className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Export JSON</span>
                                </button>
                                <button onClick={deleteSelected} disabled={selectedQuestionIds.size === 0} className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-full shadow-lg text-xs md:text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-12 h-12 md:w-auto md:h-auto whitespace-nowrap transition-all hover:scale-105">
                                    <Trash2 className="h-5 w-5 md:h-4 md:w-4" /> <span className="hidden md:inline">Delete ({selectedQuestionIds.size})</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={saveToDatabase}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-full shadow-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 animate-in fade-in zoom-in duration-300"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                                <span className="hidden md:inline">{loading ? 'Saving...' : 'Save Changes'}</span>
                            </button>
                        )}
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
                            <div id={`q-${q.id}`} key={q.id} className={`p-4 rounded border ${selectedQuestionIds.has(q.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-700'} hover:border-gray-500 transition-colors group`}>
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
                                            {q.image && (
                                                <div className="mb-2">
                                                    <img src={q.image} alt="Question" className="max-h-32 rounded border border-gray-700 hover:scale-105 transition-transform origin-left" />
                                                </div>
                                            )}
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
            {
                isDuplicateModalOpen && (
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
                )
            }
        </div >
    );
}
