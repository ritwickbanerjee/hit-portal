'use client';

import { useState } from 'react';
import { X, Plus, Upload, Image as ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface SubQuestion {
    id: string;
    text: string;
    latexContent: boolean;
    type: 'mcq' | 'msq' | 'fillblank' | 'short';
    options: string[];
    correctIndices: number[];
    shuffleOptions: boolean;
    marks: number;
    negativeMarks: number;
    fillBlankAnswer?: string;
    caseSensitive?: boolean;
    isNumberRange?: boolean;
    numberRangeMin?: number;
    numberRangeMax?: number;
}

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
    timeLimit?: number;
    options?: string[];
    correctIndices?: number[];
    shuffleOptions?: boolean;
    fillBlankAnswer?: string;
    caseSensitive?: boolean;
    isNumberRange?: boolean;
    numberRangeMin?: number;
    numberRangeMax?: number;
    comprehensionText?: string;
    comprehensionImage?: string;
    subQuestions?: SubQuestion[];
    solutionText?: string;
    solutionImage?: string;
    isGrace?: boolean;
}

interface QuestionEditorProps {
    onSave: (question: Question) => void;
    onCancel: () => void;
    initialQuestion?: Question;
}

export default function QuestionEditor({ onSave, onCancel, initialQuestion }: QuestionEditorProps) {
    const [question, setQuestion] = useState<Question>(initialQuestion || {
        id: Date.now().toString(),
        text: '',
        latexContent: false,
        type: 'mcq',
        marks: 1,
        negativeMarks: 0,
        options: ['', '', '', ''],
        correctIndices: [],
        shuffleOptions: false,
        solutionText: '',
        solutionImage: '',
        isGrace: false
    });

    const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
    const [showLatexPreview, setShowLatexPreview] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'question' | 'comprehension' | 'solution') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (target === 'question') {
                    setQuestion({ ...question, image: reader.result as string });
                } else if (target === 'solution') {
                    setQuestion({ ...question, solutionImage: reader.result as string });
                } else {
                    setQuestion({ ...question, comprehensionImage: reader.result as string });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const addOption = () => {
        setQuestion({
            ...question,
            options: [...(question.options || []), '']
        });
    };

    const updateOption = (index: number, value: string) => {
        const newOptions = [...(question.options || [])];
        newOptions[index] = value;
        setQuestion({ ...question, options: newOptions });
    };

    const toggleCorrectAnswer = (index: number) => {
        const currentIndices = question.correctIndices || [];
        if (question.type === 'mcq') {
            // MCQ: only one correct answer
            setQuestion({ ...question, correctIndices: [index] });
        } else {
            // MSQ: multiple correct answers
            if (currentIndices.includes(index)) {
                setQuestion({ ...question, correctIndices: currentIndices.filter(i => i !== index) });
            } else {
                setQuestion({ ...question, correctIndices: [...currentIndices, index] });
            }
        }
    };

    const addSubQuestion = () => {
        const newSub: SubQuestion = {
            id: Date.now().toString(),
            text: '',
            latexContent: false,
            type: 'mcq',
            options: ['', ''],
            correctIndices: [],
            shuffleOptions: false,
            marks: 1,
            negativeMarks: 0
        };
        setQuestion({
            ...question,
            subQuestions: [...(question.subQuestions || []), newSub]
        });
    };

    const updateSubQuestion = (index: number, updates: Partial<SubQuestion>) => {
        const newSubQuestions = [...(question.subQuestions || [])];
        newSubQuestions[index] = { ...newSubQuestions[index], ...updates };
        setQuestion({ ...question, subQuestions: newSubQuestions });
    };

    const removeSubQuestion = (index: number) => {
        setQuestion({
            ...question,
            subQuestions: question.subQuestions?.filter((_, i) => i !== index)
        });
    };

    const handleSave = () => {
        // Validation
        if (!question.text.trim()) {
            alert('Please enter question text');
            return;
        }

        if ((question.type === 'mcq' || question.type === 'msq') && (!question.correctIndices || question.correctIndices.length === 0)) {
            alert('Please select at least one correct answer');
            return;
        }

        if (question.type === 'fillblank') {
            if (question.isNumberRange) {
                if (question.numberRangeMin === undefined || question.numberRangeMax === undefined) {
                    alert('Please enter both minimum and maximum values for number range');
                    return;
                }
                if (question.numberRangeMin >= question.numberRangeMax) {
                    alert('Minimum value must be less than maximum value');
                    return;
                }
            } else if (!question.fillBlankAnswer?.trim()) {
                alert('Please enter the correct answer for fill in the blank');
                return;
            }
        }

        if (question.type === 'comprehension' && (!question.subQuestions || question.subQuestions.length === 0)) {
            alert('Please add at least one sub-question for comprehension');
            return;
        }

        onSave(question);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl my-8">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-2xl font-bold text-white">
                        {initialQuestion ? 'Edit Question' : 'Add New Question'}
                    </h3>
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setActiveTab('question')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'question' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Question
                        </button>
                        <button
                            onClick={() => setActiveTab('solution')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'solution' ? 'bg-emerald-600/20 text-emerald-400 shadow border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Solution & Explanation
                        </button>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-white p-2">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeTab === 'solution' ? (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                <h4 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                                    <ToggleRight className="h-5 w-5" /> Solution & Explanation
                                </h4>
                                <p className="text-sm text-slate-400 mb-4">
                                    Provide a detailed explanation for the correct answer. This will be shown to students after they complete the test (based on result visibility settings).
                                </p>

                                <textarea
                                    value={question.solutionText || ''}
                                    onChange={(e) => setQuestion({ ...question, solutionText: e.target.value })}
                                    placeholder="Enter detailed solution here... Use LaTeX for equations: $E = mc^2$"
                                    className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[200px] resize-y font-mono text-sm"
                                />

                                {/* Solution Preview */}
                                {question.solutionText && (
                                    <div className="mt-4 p-4 bg-slate-950 border border-emerald-500/30 rounded-lg">
                                        <p className="text-xs text-emerald-400 mb-2 font-medium">Preview:</p>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <Latex>{question.solutionText}</Latex>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Upload Solution Image */}
                            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
                                <label className="text-sm font-medium text-slate-300 mb-2 block">Solution Image (Optional)</label>
                                <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-300 text-sm font-medium transition-colors w-fit">
                                    <ImageIcon className="h-4 w-4" />
                                    Upload Explanation Diagram
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, 'solution')}
                                        className="hidden"
                                    />
                                </label>
                                {question.solutionImage && (
                                    <div className="mt-3 relative inline-block">
                                        <img src={question.solutionImage} alt="Solution" className="max-w-full h-auto rounded-lg border border-emerald-500/30" />
                                        <button
                                            onClick={() => setQuestion({ ...question, solutionImage: undefined })}
                                            className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Question Editor Content
                        <>
                            {/* Question Type Selector */}
                            <div>
                                <label className="text-sm font-medium text-slate-300 mb-2 block">Question Type</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { value: 'mcq', label: 'MCQ' },
                                        { value: 'msq', label: 'MSQ' },
                                        { value: 'fillblank', label: 'Fill Blank' },
                                        { value: 'comprehension', label: 'Comprehension' },
                                        { value: 'broad', label: 'Broad' }
                                    ].map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => setQuestion({ ...question, type: type.value as any })}
                                            className={`px-4 py-2 rounded-lg font-medium transition-all ${question.type === type.value
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                                : 'bg-slate-800 text-slate-400 border border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Comprehension Passage (if comprehension type) */}
                            {question.type === 'comprehension' && (
                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                    <label className="text-sm font-medium text-purple-300 mb-2 block">Comprehension Passage</label>
                                    <textarea
                                        value={question.comprehensionText || ''}
                                        onChange={(e) => setQuestion({ ...question, comprehensionText: e.target.value })}
                                        placeholder="Enter the passage/context for comprehension..."
                                        className="w-full bg-slate-950 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[120px] resize-y"
                                    />

                                    {/* Upload Image for Comprehension */}
                                    <div className="mt-3">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg cursor-pointer text-purple-300 text-sm font-medium transition-colors w-fit">
                                            <ImageIcon className="h-4 w-4" />
                                            Upload Passage Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(e, 'comprehension')}
                                                className="hidden"
                                            />
                                        </label>
                                        {question.comprehensionImage && (
                                            <div className="mt-3 relative inline-block">
                                                <img src={question.comprehensionImage} alt="Passage" className="max-w-full h-auto rounded-lg border  border-purple-500/30" />
                                                <button
                                                    onClick={() => setQuestion({ ...question, comprehensionImage: undefined })}
                                                    className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Question Text */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-300">
                                        {question.type === 'comprehension' ? 'Comprehension Instruction' : 'Question Text'}
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setQuestion({ ...question, isGrace: !question.isGrace })}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${question.isGrace
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                            title="If enabled, all students will receive full marks for this question."
                                        >
                                            <ToggleRight className={`h-4 w-4 ${question.isGrace ? "rotate-0" : "rotate-180"}`} />
                                            Grace Question
                                        </button>
                                        <button
                                            onClick={() => setQuestion({ ...question, latexContent: !question.latexContent })}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                                        >
                                            {question.latexContent ? (
                                                <><ToggleRight className="h-4 w-4 text-emerald-400" /> LaTeX Enabled</>
                                            ) : (
                                                <><ToggleLeft className="h-4 w-4 text-slate-400" /> Enable LaTeX</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={question.text}
                                    onChange={(e) => setQuestion({ ...question, text: e.target.value })}
                                    placeholder={question.type === 'comprehension' ? 'e.g., "Answer the following questions based on the passage above..."' : 'Enter your question here... Use LaTeX for equations: $E = mc^2$'}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[100px] resize-y font-mono text-sm"
                                />

                                {/* LaTeX Preview */}
                                {question.latexContent && question.text && (
                                    <div className="mt-2 p-4 bg-slate-950 border border-emerald-500/30 rounded-lg">
                                        <p className="text-xs text-emerald-400 mb-2 font-medium">Preview:</p>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <Latex>{question.text}</Latex>
                                        </div>
                                    </div>
                                )}

                                {/* Upload Question Image */}
                                <div className="mt-3">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-300 text-sm font-medium transition-colors w-fit">
                                        <Upload className="h-4 w-4" />
                                        Upload Screenshot/Image
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, 'question')}
                                            className="hidden"
                                        />
                                    </label>
                                    {question.image && (
                                        <div className="mt-3 relative inline-block">
                                            <img src={question.image} alt="Question" className="max-w-full h-auto rounded-lg border border-slate-700" />
                                            <button
                                                onClick={() => setQuestion({ ...question, image: undefined })}
                                                className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Type-specific editors */}
                            {(question.type === 'mcq' || question.type === 'msq') && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-300">Options</label>
                                        <button
                                            onClick={() => setQuestion({ ...question, shuffleOptions: !question.shuffleOptions })}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${question.shuffleOptions
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {question.shuffleOptions ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                            Shuffle Options
                                        </button>
                                    </div>
                                    {question.options?.map((option, index) => (
                                        <div key={index} className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleCorrectAnswer(index)}
                                                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${question.correctIndices?.includes(index)
                                                        ? 'bg-emerald-500 border-emerald-500'
                                                        : 'border-slate-600 hover:border-slate-500'
                                                        }`}
                                                >
                                                    {question.correctIndices?.includes(index) && (
                                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => updateOption(index, e.target.value)}
                                                    placeholder={`Option ${index + 1}`}
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                                />
                                            </div>
                                            {option && (option.includes('$') || option.includes('\\')) && (
                                                <div className="pl-9 text-sm text-emerald-400 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                                                    <span className="text-xs text-slate-500 block mb-1">Preview:</span>
                                                    <Latex>{option}</Latex>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addOption}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm font-medium transition-colors"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Option
                                    </button>
                                    <p className="text-xs text-slate-500">
                                        {question.type === 'mcq' ? 'Click checkbox to mark ONE correct answer' : 'Click checkboxes to mark multiple correct answers'}
                                    </p>
                                </div>
                            )}

                            {question.type === 'fillblank' && (
                                <div className="space-y-4">
                                    {/* Answer Type Selection */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300 mb-2 block">Answer Type</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={!question.isNumberRange}
                                                    onChange={() => setQuestion({ ...question, isNumberRange: false, numberRangeMin: undefined, numberRangeMax: undefined })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-slate-300">Text Answer</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={question.isNumberRange === true}
                                                    onChange={() => setQuestion({ ...question, isNumberRange: true, fillBlankAnswer: undefined, caseSensitive: false })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-slate-300">Number Range</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Text Answer */}
                                    {!question.isNumberRange && (
                                        <>
                                            <div>
                                                <label className="text-sm font-medium text-slate-300 mb-2 block">Correct Answer</label>
                                                <input
                                                    type="text"
                                                    value={question.fillBlankAnswer || ''}
                                                    onChange={(e) => setQuestion({ ...question, fillBlankAnswer: e.target.value })}
                                                    placeholder="Enter the correct answer"
                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="caseSensitive"
                                                    checked={question.caseSensitive || false}
                                                    onChange={(e) => setQuestion({ ...question, caseSensitive: e.target.checked })}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                                                />
                                                <label htmlFor="caseSensitive" className="text-sm text-slate-400">Case sensitive</label>
                                            </div>
                                        </>
                                    )}

                                    {/* Number Range */}
                                    {question.isNumberRange && (
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                                            <p className="text-sm text-blue-300 font-medium">Number Range Settings</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Minimum Value</label>
                                                    <input
                                                        type="number"
                                                        value={question.numberRangeMin ?? ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setQuestion({ ...question, numberRangeMin: isNaN(val) ? undefined : val });
                                                        }}
                                                        placeholder="e.g., 0"
                                                        className="w-full bg-slate-950 border border-blue-500/30 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                        step="any"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Maximum Value</label>
                                                    <input
                                                        type="number"
                                                        value={question.numberRangeMax ?? ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setQuestion({ ...question, numberRangeMax: isNaN(val) ? undefined : val });
                                                        }}
                                                        placeholder="e.g., 100"
                                                        className="w-full bg-slate-950 border border-blue-500/30 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                        step="any"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                Any numeric answer between {question.numberRangeMin ?? '??'} and {question.numberRangeMax ?? '??'} (inclusive) will be accepted as correct.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Comprehension Sub-Questions */}
                            {question.type === 'comprehension' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-slate-300">Sub-Questions</label>
                                        <button
                                            onClick={addSubQuestion}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 text-sm font-medium transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Sub-Question
                                        </button>
                                    </div>

                                    {question.subQuestions?.map((subQ, index) => (
                                        <div key={subQ.id} className="bg-slate-950/50 border border-purple-500/30 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-purple-300">Sub-Question {index + 1}</span>
                                                <button
                                                    onClick={() => removeSubQuestion(index)}
                                                    className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>

                                            <textarea
                                                value={subQ.text}
                                                onChange={(e) => updateSubQuestion(index, { text: e.target.value })}
                                                placeholder="Sub-question text"
                                                className="w-full bg-slate-900 border border-purple-500/30 rounded px-3 py-2 text-white text-sm min-h-[60px]"
                                            />

                                            {/* Sub-question type */}
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'mcq', label: 'MCQ' },
                                                    { id: 'msq', label: 'MSQ' },
                                                    { id: 'fillblank', label: 'Fill in the blanks' }
                                                ].map(type => (
                                                    <button
                                                        key={type.id}
                                                        onClick={() => updateSubQuestion(index, { type: type.id as any })}
                                                        className={`px-3 py-1 rounded text-xs font-medium ${subQ.type === type.id
                                                            ? 'bg-purple-500/30 text-purple-200'
                                                            : 'bg-slate-800 text-slate-400'
                                                            }`}
                                                    >
                                                        {type.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {(subQ.type === 'mcq' || subQ.type === 'msq') && (
                                                <div className="space-y-2">
                                                    {subQ.options.map((opt, optIdx) => (
                                                        <div key={optIdx} className="flex items-center gap-2">
                                                            <input
                                                                type={subQ.type === 'mcq' ? 'radio' : 'checkbox'}
                                                                checked={subQ.correctIndices.includes(optIdx)}
                                                                onChange={() => {
                                                                    const newIndices = subQ.type === 'mcq'
                                                                        ? [optIdx]
                                                                        : subQ.correctIndices.includes(optIdx)
                                                                            ? subQ.correctIndices.filter(i => i !== optIdx)
                                                                            : [...subQ.correctIndices, optIdx];
                                                                    updateSubQuestion(index, { correctIndices: newIndices });
                                                                }}
                                                                className="w-4 h-4"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={opt}
                                                                onChange={(e) => {
                                                                    const newOpts = [...subQ.options];
                                                                    newOpts[optIdx] = e.target.value;
                                                                    updateSubQuestion(index, { options: newOpts });
                                                                }}
                                                                placeholder={`Option ${optIdx + 1}`}
                                                                className="flex-1 bg-slate-900 border border-purple-500/30 rounded px-3 py-1 text-white text-sm"
                                                            />
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => updateSubQuestion(index, { options: [...subQ.options, ''] })}
                                                        className="text-xs text-purple-400 hover:text-purple-300"
                                                    >
                                                        + Add Option
                                                    </button>
                                                </div>
                                            )}

                                            {subQ.type === 'fillblank' && (
                                                <div className="space-y-3 bg-slate-900/50 p-3 rounded border border-purple-500/20">
                                                    {/* Answer Type Selection */}
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={!subQ.isNumberRange}
                                                                onChange={() => updateSubQuestion(index, { isNumberRange: false, numberRangeMin: undefined, numberRangeMax: undefined })}
                                                                className="w-3 h-3 text-purple-500"
                                                            />
                                                            <span className="text-xs text-slate-300">Text Answer</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                checked={subQ.isNumberRange === true}
                                                                onChange={() => updateSubQuestion(index, { isNumberRange: true, fillBlankAnswer: undefined, caseSensitive: false })}
                                                                className="w-3 h-3 text-purple-500"
                                                            />
                                                            <span className="text-xs text-slate-300">Number Range</span>
                                                        </label>
                                                    </div>

                                                    {/* Text Answer Input */}
                                                    {!subQ.isNumberRange && (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text"
                                                                value={subQ.fillBlankAnswer || ''}
                                                                onChange={(e) => updateSubQuestion(index, { fillBlankAnswer: e.target.value })}
                                                                placeholder="Enter correct answer"
                                                                className="w-full bg-slate-900 border border-purple-500/30 rounded px-3 py-1 text-white text-sm"
                                                            />
                                                            <label className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={subQ.caseSensitive || false}
                                                                    onChange={(e) => updateSubQuestion(index, { caseSensitive: e.target.checked })}
                                                                    className="w-3 h-3 rounded border-slate-600 bg-slate-900 text-purple-500"
                                                                />
                                                                <span className="text-xs text-slate-400">Case sensitive</span>
                                                            </label>
                                                        </div>
                                                    )}

                                                    {/* Number Range Input */}
                                                    {subQ.isNumberRange && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-xs text-slate-400 block mb-1">Min Value</label>
                                                                <input
                                                                    type="number"
                                                                    value={subQ.numberRangeMin ?? ''}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value);
                                                                        updateSubQuestion(index, { numberRangeMin: isNaN(val) ? undefined : val });
                                                                    }}
                                                                    className="w-full bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-sm"
                                                                    step="any"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 block mb-1">Max Value</label>
                                                                <input
                                                                    type="number"
                                                                    value={subQ.numberRangeMax ?? ''}
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value);
                                                                        updateSubQuestion(index, { numberRangeMax: isNaN(val) ? undefined : val });
                                                                    }}
                                                                    className="w-full bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-sm"
                                                                    step="any"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-3">
                                                <div>
                                                    <label className="text-xs text-slate-400">Marks</label>
                                                    <input
                                                        type="number"
                                                        value={subQ.marks || ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            updateSubQuestion(index, { marks: isNaN(val) ? 0 : val });
                                                        }}
                                                        className="w-20 bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-400">Negative</label>
                                                    <input
                                                        type="number"
                                                        value={subQ.negativeMarks || ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            updateSubQuestion(index, { negativeMarks: isNaN(val) ? 0 : val });
                                                        }}
                                                        className="w-20 bg-slate-900 border border-purple-500/30 rounded px-2 py-1 text-white text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Marks */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Marks</label>
                                    <input
                                        type="number"
                                        value={question.marks || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setQuestion({ ...question, marks: isNaN(val) ? 0 : val });
                                        }}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        min="0"
                                        step="0.5"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Negative Marks</label>
                                    <input
                                        type="number"
                                        value={question.negativeMarks || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setQuestion({ ...question, negativeMarks: isNaN(val) ? 0 : val });
                                        }}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        min="0"
                                        step="0.25"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Time Limit (Sec)</label>
                                    <input
                                        type="number"
                                        value={question.timeLimit || ''}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setQuestion({ ...question, timeLimit: isNaN(val) ? undefined : val });
                                        }}
                                        placeholder="Optional"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        min="10"
                                    />
                                </div>
                            </div>

                            {/* Topic/Subtopic (Optional) */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Topic (Optional)</label>
                                    <input
                                        type="text"
                                        value={question.topic || ''}
                                        onChange={(e) => setQuestion({ ...question, topic: e.target.value })}
                                        placeholder="e.g., Algebra"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Subtopic (Optional)</label>
                                    <input
                                        type="text"
                                        value={question.subtopic || ''}
                                        onChange={(e) => setQuestion({ ...question, subtopic: e.target.value })}
                                        placeholder="e.g., Quadratic Equations"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20"
                    >
                        {initialQuestion ? 'Update Question' : 'Add Question'}
                    </button>
                </div>
            </div >
        </div >
    );
}
