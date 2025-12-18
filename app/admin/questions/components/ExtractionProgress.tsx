'use client';

import { Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface ExtractionProgressProps {
    stage: 'idle' | 'initializing' | 'processing' | 'uploading' | 'analyzing' | 'extracting' | 'parsing' | 'validating' | 'complete' | 'error';
    progress: number;
    questionsFound: number;
    currentFile?: string;
    error?: string;
}

export default function ExtractionProgress({
    stage,
    progress,
    questionsFound,
    currentFile,
    error
}: ExtractionProgressProps) {
    const stages = [
        { key: 'uploading', label: 'Uploading File', icon: '📤' },
        { key: 'analyzing', label: 'Analyzing Content', icon: '🔍' },
        { key: 'extracting', label: 'Extracting Questions', icon: '📝' },
        { key: 'validating', label: 'Validating Results', icon: '✓' },
    ];

    const getCurrentStageIndex = () => {
        return stages.findIndex(s => s.key === stage);
    };

    const currentStageIndex = getCurrentStageIndex();

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                    {stage === 'error' ? (
                        <>
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            Extraction Failed
                        </>
                    ) : stage === 'complete' ? (
                        <>
                            <CheckCircle className="h-5 w-5 text-green-400" />
                            Extraction Complete
                        </>
                    ) : (
                        <>
                            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                            Processing...
                        </>
                    )}
                </h3>

                {currentFile && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <FileText className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{currentFile}</span>
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            {stage !== 'error' && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>{stages[currentStageIndex]?.label || 'Processing'}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Stage Indicators */}
            {stage !== 'error' && (
                <div className="grid grid-cols-4 gap-2">
                    {stages.map((s, index) => {
                        const isActive = index === currentStageIndex;
                        const isComplete = index < currentStageIndex || stage === 'complete';

                        return (
                            <div
                                key={s.key}
                                className={`
                  text-center p-2 rounded border transition-all
                  ${isActive ? 'border-blue-400 bg-blue-400/10' :
                                        isComplete ? 'border-green-400 bg-green-400/10' :
                                            'border-gray-700 bg-gray-900'}
                `}
                            >
                                <div className="text-xl mb-1">{s.icon}</div>
                                <div className={`
                  text-xs font-medium
                  ${isActive ? 'text-blue-300' :
                                        isComplete ? 'text-green-300' :
                                            'text-gray-500'}
                `}>
                                    {s.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Questions Counter */}
            {questionsFound > 0 && (
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                        {questionsFound}
                    </div>
                    <div className="text-sm text-purple-300">
                        Question{questionsFound !== 1 ? 's' : ''} Found
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm font-medium mb-2">Error Details:</p>
                    <p className="text-red-200 text-xs font-mono break-all">{error}</p>
                </div>
            )}

            {/* Success Message */}
            {stage === 'complete' && questionsFound > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-300 text-sm">
                        ✨ Successfully extracted {questionsFound} question{questionsFound !== 1 ? 's' : ''}!
                        Review them in the preview panel and click Save when ready.
                    </p>
                </div>
            )}
        </div>
    );
}
