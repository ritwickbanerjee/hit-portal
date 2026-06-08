import React from 'react';
import { Layers } from 'lucide-react';

interface BatchTabSwitcherProps {
    batches: string[];
    selectedBatch: string | null;
    onSelect: (batch: string | null) => void;
}

export default function BatchTabSwitcher({ batches, selectedBatch, onSelect }: BatchTabSwitcherProps) {
    if (!batches || batches.length <= 1) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 bg-slate-800/30 p-1 rounded-xl w-fit">
            <button
                onClick={() => onSelect(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedBatch === null 
                        ? 'bg-slate-700 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
            >
                <Layers className="h-4 w-4" />
                All Batches
            </button>
            
            {batches.map((batch) => (
                <button
                    key={batch}
                    onClick={() => onSelect(batch)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedBatch === batch 
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                >
                    {batch}
                </button>
            ))}
        </div>
    );
}
