'use client';

import { useState, useEffect, memo } from 'react';
import { Search, CheckSquare, Square } from 'lucide-react';
import LatexWrapper from './LatexWrapper';

interface Question {
    _id: string;
    text: string;
    topic: string;
}

interface Props {
    questions: Question[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

const QuestionSelector = memo(function QuestionSelector({ questions, selectedIds, onChange }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtered, setFiltered] = useState<Question[]>([]);

    useEffect(() => {
        const lower = searchTerm.toLowerCase();
        setFiltered(questions.filter(q =>
            q.text.toLowerCase().includes(lower) ||
            q.topic.toLowerCase().includes(lower)
        ));
    }, [searchTerm, questions]);

    const toggleOne = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(s => s !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const toggleAllFiltered = () => {
        const ids = filtered.map(q => q._id);
        const allSelected = ids.every(id => selectedIds.includes(id));

        if (allSelected) {
            // Unselect all currently visible
            onChange(selectedIds.filter(id => !ids.includes(id)));
        } else {
            // Select all currently visible
            const newSet = new Set([...selectedIds, ...ids]);
            onChange(Array.from(newSet));
        }
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-700 bg-gray-800 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-medium text-white">Question Pool ({selectedIds.length} / {questions.length} selected)</h4>
                    <button
                        type="button"
                        onClick={toggleAllFiltered}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                        {filtered.every(q => selectedIds.includes(q._id)) ? 'Unselect Visible' : 'Select Visible'}
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 block w-full rounded bg-gray-900 border-gray-600 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">No questions found</p>
                ) : (
                    filtered.map(q => {
                        const isSelected = selectedIds.includes(q._id);
                        return (
                            <div
                                key={q._id}
                                onClick={() => toggleOne(q._id)}
                                className={`
                                    flex items-start gap-3 p-3 rounded cursor-pointer transition-colors border
                                    ${isSelected
                                        ? 'bg-blue-900/20 border-blue-500/30 hover:bg-blue-900/30'
                                        : 'bg-gray-900/30 border-gray-700 hover:bg-gray-800'}
                                `}
                            >
                                <div className={`mt-0.5 ${isSelected ? 'text-blue-400' : 'text-gray-600'}`}>
                                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">{q.topic}</div>
                                    <div className="text-sm text-gray-200">
                                        <LatexWrapper>{q.text}</LatexWrapper>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
});

export default QuestionSelector;
