'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Filter, Loader2, Check, Plus } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';
import MultiSelect from '../../assignments/components/MultiSelect';

interface Question {
    id: string;
    text: string;
    image?: string;
    latexContent: boolean;
    type: 'mcq' | 'msq' | 'fillblank' | 'comprehension' | 'broad';
    topic?: string;
    subtopic?: string;
    marks: number;
    negativeMarks: number;
    options?: string[];
    correctIndices?: number[];
    fillBlankAnswer?: string;
    explanation?: string;
}

interface QuestionImportModalProps {
    onImport: (questions: Question[]) => void;
    onCancel: () => void;
}

export default function QuestionImportModal({ onImport, onCancel }: QuestionImportModalProps) {
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const user = localStorage.getItem('user');
            const email = user ? JSON.parse(user).email : '';

            const res = await fetch('/api/admin/questions', {
                headers: { 'X-User-Email': email }
            });

            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
        } finally {
            setLoading(false);
        }
    };

    const topics = useMemo(() => {
        return Array.from(new Set(questions.map(q => q.topic).filter(Boolean))).sort() as string[];
    }, [questions]);

    const subtopics = useMemo(() => {
        const filtered = selectedTopics.length > 0
            ? questions.filter(q => selectedTopics.includes(q.topic))
            : questions;
        return Array.from(new Set(filtered.map(q => q.subtopic).filter(Boolean))).sort() as string[];
    }, [questions, selectedTopics]);

    const types = ['mcq', 'blanks', 'broad', 'short'];

    const availableBatchNames = useMemo(() => {
        const set = new Set<string>();
        questions.forEach(q => {
            if (q.batches && Array.isArray(q.batches)) (q as any).batches.forEach((b: string) => set.add(b));
        });
        const batchNames = Array.from(set).filter(Boolean).sort();
        return ['Untagged', ...batchNames];
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            const topicMatch = selectedTopics.length === 0 || selectedTopics.includes(q.topic);
            const subtopicMatch = selectedSubtopics.length === 0 || selectedSubtopics.includes(q.subtopic);
            const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(q.type);

            // Batch filter
            let batchMatch = true;
            if (selectedBatches.length > 0) {
                const qBatches = (q as any).batches || [];
                const wantUntagged = selectedBatches.includes('Untagged');
                const realBatches = selectedBatches.filter(b => b !== 'Untagged');
                batchMatch = (wantUntagged && qBatches.length === 0) ||
                    (realBatches.length > 0 && realBatches.some(b => qBatches.includes(b)));
            }

            const searchLower = searchQuery.toLowerCase();
            const searchMatch = !searchQuery ||
                (q.text || '').toLowerCase().includes(searchLower) ||
                (q.topic || '').toLowerCase().includes(searchLower) ||
                (q.subtopic || '').toLowerCase().includes(searchLower);

            return topicMatch && subtopicMatch && typeMatch && batchMatch && searchMatch;
        });
    }, [questions, searchQuery, selectedTopics, selectedSubtopics, selectedTypes, selectedBatches]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleImport = () => {
        const selectedQuestions = questions.filter(q => selectedIds.has(q.id));
        const mappedQuestions = selectedQuestions.map(q => {
            let type = q.type;
            if (type === 'blanks') type = 'fillblank';
            if (type === 'short') type = 'broad';

            const testQ: any = { // Using any broadly here to match target Question type
                id: `q_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                text: q.text,
                image: q.image,
                latexContent: true,
                type: type as any,
                topic: q.topic,
                subtopic: q.subtopic,
                marks: q.marks || 1,
                negativeMarks: 0,
                options: q.options && q.options.length > 0 ? q.options : (type === 'mcq' ? ['', '', '', ''] : []),
                correctIndices: [],
                fillBlankAnswer: type === 'fillblank' ? q.answer : undefined,
                solutionText: q.explanation // Map explanation to solutionText
            };

            // Attempt to derive correct indices for MCQ
            if (type === 'mcq' && q.answer && q.options) {
                const index = q.options.indexOf(q.answer);
                if (index !== -1) {
                    testQ.correctIndices = [index];
                } else {
                    const idx = parseInt(q.answer);
                    if (!isNaN(idx) && idx >= 0 && idx < q.options.length) {
                        testQ.correctIndices = [idx];
                    }
                }
            }

            return testQ as Question;
        });

        onImport(mappedQuestions);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Plus className="h-6 w-6 text-emerald-400" />
                            Import Questions from Bank
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">Select questions to add to your test</p>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-white p-2">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-6 bg-slate-950/30 border-b border-white/5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search questions..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>

                        <MultiSelect
                            options={topics}
                            selected={selectedTopics}
                            onChange={setSelectedTopics}
                            placeholder="All Topics"
                        />

                        <MultiSelect
                            options={subtopics}
                            selected={selectedSubtopics}
                            onChange={setSelectedSubtopics}
                            placeholder="All Subtopics"
                        />

                        <MultiSelect
                            options={types}
                            selected={selectedTypes}
                            onChange={setSelectedTypes}
                            placeholder="All Types"
                        />

                        <MultiSelect
                            options={availableBatchNames}
                            selected={selectedBatches}
                            onChange={setSelectedBatches}
                            placeholder="All Batches"
                        />
                    </div>
                </div>

                {/* Question List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                            <span>Loading Question Bank...</span>
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-950/20 rounded-xl border border-dashed border-slate-800">
                            <Filter className="h-10 w-10 mb-4 opacity-20" />
                            <p>No questions found matching your filters</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredQuestions.map((q) => (
                                <div
                                    key={q.id}
                                    onClick={() => toggleSelection(q.id)}
                                    className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${selectedIds.has(q.id)
                                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                                        : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(q.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-slate-500'
                                            }`}>
                                            {selectedIds.has(q.id) && <Check className="h-3.5 w-3.5 text-white" />}
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider">
                                                    {q.type}
                                                </span>
                                                {q.topic && (
                                                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded uppercase">
                                                        {q.topic}
                                                    </span>
                                                )}
                                                {q.subtopic && (
                                                    <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded uppercase">
                                                        {q.subtopic}
                                                    </span>
                                                )}
                                                {(q.examNames?.length > 0 ? q.examNames : (q.examName ? [q.examName] : [])).map((exam: string, idx: number) => (
                                                    <span key={idx} className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded uppercase">
                                                        {exam}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none">
                                                <Latex>{q.text || ''}</Latex>
                                            </div>

                                            {q.image && (
                                                <div className="mt-2 rounded overflow-hidden border border-white/5 opacity-80 group-hover:opacity-100 transition-opacity flex justify-start">
                                                    <img src={q.image} alt="Question Image" className="max-h-64 object-contain" />
                                                </div>
                                            )}

                                            {q.type === 'mcq' && q.options && q.options.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {q.options.map((opt: string, idx: number) => {
                                                        const isCorrect = String(q.answer) === String(opt) || String(q.answer) === String(idx);
                                                        return (
                                                            <div key={idx} className={`flex items-start gap-2 p-2 rounded border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/50 border-white/5'}`}>
                                                                <span className={`text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded flex-shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                                    {String.fromCharCode(65 + idx)}
                                                                </span>
                                                                <div className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none break-words overflow-hidden">
                                                                    <Latex>{opt || ''}</Latex>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-between bg-slate-900/50 rounded-b-2xl">
                    <p className="text-sm text-slate-400">
                        <span className="text-emerald-400 font-bold">{selectedIds.size}</span> questions selected
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={selectedIds.size === 0}
                            onClick={handleImport}
                            className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            Import Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
