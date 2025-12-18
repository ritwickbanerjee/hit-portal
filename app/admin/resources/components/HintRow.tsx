import React, { useState, useEffect } from 'react';
import { Trash2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import Latex from 'react-latex-next';
import 'katex/dist/katex.min.css';

interface HintRowProps {
    index: number;
    question: any;
    hints: string[];
    onHintsChange: (hints: string[]) => void;
    onDelete: () => void;
}

export default function HintRow({ index, question, hints, onHintsChange, onDelete }: HintRowProps) {
    const [jsonInput, setJsonInput] = useState(JSON.stringify(hints, null, 2));
    const [error, setError] = useState<string | null>(null);
    const [localHints, setLocalHints] = useState<string[]>(hints);

    // Sync input when props change
    useEffect(() => {
        setJsonInput(JSON.stringify(hints, null, 2));
        setLocalHints(hints);
    }, [hints]);

    const handleJsonChange = (val: string) => {
        setJsonInput(val);
        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) throw new Error("Must be an array of strings");
            if (parsed.some(i => typeof i !== 'string')) throw new Error("All items must be strings");

            setError(null);
            setLocalHints(parsed);
            onHintsChange(parsed);
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-700 bg-gray-900 group">
            {/* Left: Question + Editor */}
            <div className="p-4 border-r border-gray-700 flex flex-col gap-4">
                {/* Question Text (Read Only) */}
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Q{index + 1} • {question.topic}
                        </span>
                        <button
                            onClick={onDelete}
                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                            title="Remove from list"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="text-sm text-gray-300 line-clamp-3">
                        <Latex>{question.text || question.content}</Latex>
                    </div>
                </div>

                {/* Hints Editor */}
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Hints JSON Array</label>
                        {error && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Invalid JSON</span>}
                    </div>
                    <textarea
                        className={`flex-1 w-full bg-gray-950 p-3 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-1 transition-all min-h-[120px] ${error ? 'border-red-500/50 focus:ring-red-500' : 'border-gray-700 focus:ring-blue-500'
                            }`}
                        value={jsonInput}
                        onChange={(e) => handleJsonChange(e.target.value)}
                        placeholder='["Hint 1...", "Hint 2..."]'
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Right: Live Preview */}
            <div className="p-6 bg-gray-50 text-gray-800">
                <div className="prose prose-sm max-w-none">
                    <div className="font-medium text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Preview
                    </div>

                    <div className="mb-6">
                        <div className="text-sm text-gray-800 leading-relaxed">
                            <Latex>{question.text || question.content}</Latex>
                        </div>
                    </div>

                    {localHints && localHints.length > 0 ? (
                        <div className="pl-4 border-l-2 border-green-500 bg-green-50/50 p-3 rounded-r">
                            <h5 className="text-xs font-bold text-green-700 uppercase mb-2">Hints</h5>
                            <ul className="list-disc list-inside space-y-2">
                                {localHints.map((hint, i) => (
                                    <li key={i} className="text-sm text-gray-700">
                                        <Latex>{hint}</Latex>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 italic">
                            No hints added yet. Use the editor to add hints or generate with AI.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
