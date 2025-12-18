'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface QuestionRowProps {
    index: number;
    question: any;
    mode?: string; // 'latex', 'json', 'pdf'
    topics?: string[];
    subtopics?: string[];
    onChange: (updated: any) => void;
    onDelete: () => void;
}

export default function QuestionRow({ index, question, mode, topics = [], subtopics = [], onChange, onDelete }: QuestionRowProps) {
    // Local state for immediate UI feedback
    const [localQuestion, setLocalQuestion] = useState(question);
    const [jsonInput, setJsonInput] = useState(JSON.stringify(question, null, 2));
    const [error, setError] = useState<string | null>(null);

    // Ref to track if the update is coming from local user input vs parent prop change
    const isLocalUpdate = useRef(false);

    // Debounce timer ref
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Sync from Props to Local State
    useEffect(() => {
        if (!isLocalUpdate.current) {
            setLocalQuestion(question);
            setJsonInput(JSON.stringify(question, null, 2));
        }
        isLocalUpdate.current = false;
    }, [question]);

    const updateParent = (updated: any) => {
        isLocalUpdate.current = true;
        setLocalQuestion(updated);

        // Clear existing timer
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        // Debounce parent update
        debounceTimer.current = setTimeout(() => {
            onChange(updated);
            isLocalUpdate.current = false;
        }, 500); // 500ms debounce
    };

    const handleJsonChange = (val: string) => {
        setJsonInput(val);
        try {
            const parsed = JSON.parse(val);
            setError(null);
            updateParent(parsed);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleFieldChange = (field: string, value: string) => {
        const updated = { ...localQuestion, [field]: value };
        updateParent(updated);
    };

    if (mode === 'latex') {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
                {/* Left: Raw Latex Editor */}
                <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1} Latex Content</span>
                        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <textarea
                        className="flex-1 w-full bg-gray-950 p-4 rounded border border-gray-700 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[150px] text-gray-300"
                        value={localQuestion.text || ''}
                        onChange={(e) => handleFieldChange('text', e.target.value)}
                        placeholder="Write your question in LateX here..."
                    />
                </div>

                {/* Right: Preview + Metadata Inputs */}
                <div className="p-6 bg-gray-50 flex flex-col gap-4">
                    <div className="prose prose-sm max-w-none mb-4 min-h-[60px]">
                        <div className="font-bold text-gray-400 text-xs uppercase mb-2">Preview</div>
                        <div className="text-lg text-black leading-relaxed">
                            <Latex>{localQuestion.text || ''}</Latex>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Topic</label>
                            <input
                                list={`topics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.topic || ''}
                                onChange={(e) => handleFieldChange('topic', e.target.value)}
                                placeholder="Select/Type"
                            />
                            <datalist id={`topics-${index}`}>
                                {topics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtopic</label>
                            <input
                                list={`subtopics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.subtopic || ''}
                                onChange={(e) => handleFieldChange('subtopic', e.target.value)}
                                placeholder="Select/Type"
                            />
                            <datalist id={`subtopics-${index}`}>
                                {subtopics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
                            <select
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.type || 'broad'}
                                onChange={(e) => handleFieldChange('type', e.target.value)}
                            >
                                <option value="broad">Broad</option>
                                <option value="mcq">MCQ</option>
                                <option value="blanks">Blanks</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Image Mode ---
    if (mode === 'image') {
        const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) { // 5MB hard limit
                setError('File too large (Max 5MB)');
                return;
            }

            // Client-side compression
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize large images
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Compress to JPEG 0.7 quality
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                    if (compressedBase64.length > 500 * 1024) {
                        // If still > 500KB, try more aggressive compression
                        const aggressive = canvas.toDataURL('image/jpeg', 0.5);
                        updateParent({ ...localQuestion, image: aggressive });
                    } else {
                        updateParent({ ...localQuestion, image: compressedBase64 });
                    }
                    setError(null);
                };
            };
        };

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
                {/* Left: Inputs (Image + Text) */}
                <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1} Editor</span>
                        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>

                    {/* Image Input */}
                    {!localQuestion.image ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded bg-gray-950 p-6 transition-colors hover:border-blue-500 min-h-[150px]">
                            <input type="file" accept="image/*" className="hidden" id={`img-upload-${index}`} onChange={handleImageUpload} />
                            <label htmlFor={`img-upload-${index}`} className="flex flex-col items-center cursor-pointer">
                                <div className="bg-gray-800 p-3 rounded-full mb-3 text-blue-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                </div>
                                <span className="text-xs font-bold text-white mb-1">Upload Image</span>
                                <span className="text-[10px] text-gray-400">Graphs, Circuits, Diagrams (Max 5MB)</span>
                            </label>
                            {error && <span className="text-xs text-red-500 mt-2">{error}</span>}
                        </div>
                    ) : (
                        <div className="relative group/preview min-h-[150px] bg-gray-950 flex items-center justify-center rounded border border-gray-700 overflow-hidden">
                            <img src={localQuestion.image} alt="Preview" className="max-w-full max-h-[200px] object-contain" />
                            <button
                                onClick={() => updateParent({ ...localQuestion, image: '' })}
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover/preview:opacity-100 transition-opacity"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Text Input */}
                    <div className="flex flex-col gap-2 flex-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Input Question Text (Latex)</label>
                        <textarea
                            className="w-full h-full min-h-[150px] bg-gray-950 p-4 rounded border border-gray-700 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-300 resize-y"
                            placeholder="Enter the text of the question (Latex)..."
                            value={localQuestion.text || ''}
                            onChange={(e) => handleFieldChange('text', e.target.value)}
                        />
                    </div>
                </div>

                {/* Right: Full Preview + Metadata */}
                <div className="p-6 bg-gray-50 flex flex-col gap-4">
                    {/* Preview Area */}
                    <div className="flex-1 border border-gray-200 rounded p-4 bg-white shadow-sm overflow-auto min-h-[200px]">
                        <div className="font-bold text-gray-400 text-xs uppercase mb-4 border-b pb-2">Live Preview</div>

                        <div className="space-y-4">
                            {/* Image Preview in Context */}
                            {localQuestion.image && (
                                <div className="flex justify-center">
                                    <img src={localQuestion.image} alt="Question Image" className="max-w-full max-h-[300px] object-contain rounded" />
                                </div>
                            )}

                            {/* Text Preview in Context */}
                            <div className="text-lg text-black leading-relaxed">
                                {localQuestion.text ? (
                                    <Latex>{localQuestion.text}</Latex>
                                ) : (
                                    <span className="text-gray-400 italic text-sm">Question text will appear here...</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded border border-gray-200 shadow-sm mt-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Topic <span className="text-red-500">*</span></label>
                            <input
                                list={`topics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.topic || ''}
                                onChange={(e) => handleFieldChange('topic', e.target.value)}
                                placeholder="Required"
                            />
                            <datalist id={`topics-${index}`}>
                                {topics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subtopic <span className="text-red-500">*</span></label>
                            <input
                                list={`subtopics-${index}`}
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.subtopic || ''}
                                onChange={(e) => handleFieldChange('subtopic', e.target.value)}
                                placeholder="Required"
                            />
                            <datalist id={`subtopics-${index}`}>
                                {subtopics.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type <span className="text-red-500">*</span></label>
                            <select
                                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                value={localQuestion.type || 'broad'}
                                onChange={(e) => handleFieldChange('type', e.target.value)}
                            >
                                <option value="broad">Broad</option>
                                <option value="mcq">MCQ</option>
                                <option value="blanks">Blanks</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default (JSON) Row View
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
            {/* Left: JSON Editor */}
            <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">JSON Object</span>
                    <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
                {error && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Invalid JSON</span>}
                <textarea
                    className={`flex-1 w-full bg-gray-950 p-3 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-1 transition-all min-h-[150px] ${error ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-700 focus:ring-blue-500'
                        }`}
                    value={jsonInput}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    spellCheck={false}
                />
            </div>

            {/* Right: Live Preview */}
            <div className="p-4 bg-gray-50 min-h-[200px]">
                {!error ? (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                            <div className="flex gap-2 flex-wrap">
                                <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{localQuestion.topic || 'No Topic'}</span>
                                <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">{localQuestion.subtopic || 'No Subtopic'}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono uppercase">{localQuestion.type || 'Unknown'}</span>
                        </div>
                        <div className="text-gray-800 text-sm prose prose-sm max-w-none">
                            {localQuestion.text ? <Latex>{localQuestion.text}</Latex> : <span className="text-gray-400 italic">(No text content)</span>}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                        Fix JSON to see preview
                    </div>
                )}
            </div>
        </div>
    );
}
