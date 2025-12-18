'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Wrench, RefreshCw, Copy } from 'lucide-react';

interface ValidationIssue {
    type: 'error' | 'warning';
    field?: string;
    message: string;
    suggestion?: string;
    autoFixable?: boolean;
}

interface AutoDebuggerProps {
    jsonContent: string;
    issues: ValidationIssue[];
    onAutoFix?: (fixedJSON: string) => void;
    onRetry?: () => void;
}

export default function AutoDebugger({ jsonContent, issues, onAutoFix, onRetry }: AutoDebuggerProps) {
    const [isFixing, setIsFixing] = useState(false);

    if (issues.length === 0) {
        return (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <div>
                    <p className="text-green-300 font-bold text-sm">All Clear!</p>
                    <p className="text-green-200/80 text-xs">No validation issues detected</p>
                </div>
            </div>
        );
    }

    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    const autoFixableCount = issues.filter(i => i.autoFixable).length;

    const handleAutoFix = async () => {
        setIsFixing(true);

        try {
            // Simulate auto-fix logic
            let fixed = jsonContent;

            // Remove markdown code blocks
            if (fixed.includes('```')) {
                fixed = fixed.replace(/```(?:json)?\s*/g, '').replace(/```/g, '');
            }

            // Try to parse and fix common issues
            try {
                const parsed = JSON.parse(fixed);

                // Ensure it's an array
                const array = Array.isArray(parsed) ? parsed : [parsed];

                // Add missing fields with defaults
                const fixedArray = array.map((item: any) => ({
                    text: item.text || '',
                    type: item.type || 'broad',
                    topic: item.topic || 'General',
                    subtopic: item.subtopic || 'General',
                    ...item
                }));

                const fixedJSON = JSON.stringify(fixedArray, null, 2);

                if (onAutoFix) {
                    onAutoFix(fixedJSON);
                }
            } catch (e) {
                // If parsing fails, just clean up the text
                if (onAutoFix) {
                    onAutoFix(fixed);
                }
            }
        } finally {
            setIsFixing(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(jsonContent);
        alert('JSON copied to clipboard!');
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-red-900/30 border-b border-red-500/30 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div>
                        <h4 className="text-white font-bold text-sm">Validation Issues Detected</h4>
                        <p className="text-red-200/80 text-xs mt-0.5">
                            {errorCount} error{errorCount !== 1 ? 's' : ''} •
                            {warningCount} warning{warningCount !== 1 ? 's' : ''}
                            {autoFixableCount > 0 && ` • ${autoFixableCount} auto-fixable`}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {autoFixableCount > 0 && (
                        <button
                            onClick={handleAutoFix}
                            disabled={isFixing}
                            className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {isFixing ? (
                                <>
                                    <Wrench className="h-3 w-3 animate-spin" />
                                    Fixing...
                                </>
                            ) : (
                                <>
                                    <Wrench className="h-3 w-3" />
                                    Auto-Fix ({autoFixableCount})
                                </>
                            )}
                        </button>
                    )}

                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Retry Extraction
                        </button>
                    )}
                </div>
            </div>

            {/* Issues List */}
            <div className="p-4 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {issues.map((issue, index) => (
                    <div
                        key={index}
                        className={`
              border rounded-lg p-3
              ${issue.type === 'error'
                                ? 'bg-red-900/10 border-red-500/30'
                                : 'bg-yellow-900/10 border-yellow-500/30'}
            `}
                    >
                        <div className="flex items-start gap-2">
                            <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${issue.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                                }`} />

                            <div className="flex-1 min-w-0">
                                {issue.field && (
                                    <p className={`text-xs font-bold mb-0.5 ${issue.type === 'error' ? 'text-red-300' : 'text-yellow-300'
                                        }`}>
                                        Field: {issue.field}
                                    </p>
                                )}
                                <p className={`text-sm ${issue.type === 'error' ? 'text-red-200' : 'text-yellow-200'
                                    }`}>
                                    {issue.message}
                                </p>

                                {issue.suggestion && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        💡 <span className="italic">{issue.suggestion}</span>
                                    </p>
                                )}

                                {issue.autoFixable && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                                        <Wrench className="h-3 w-3" />
                                        <span>Can be auto-fixed</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-900 border-t border-gray-700 p-3 flex justify-between items-center">
                <p className="text-xs text-gray-400">
                    Review and fix issues manually, or use auto-fix for common problems
                </p>
                <button
                    onClick={copyToClipboard}
                    className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
                >
                    <Copy className="h-3 w-3" />
                    Copy JSON
                </button>
            </div>
        </div>
    );
}
