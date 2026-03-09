'use client';

import { useEffect, useState } from 'react';
import { Zap, Clock, AlertTriangle } from 'lucide-react';

interface TokenUsageIndicatorProps {
    userEmail: string;
    onQuotaExhausted?: () => void;
    refreshTrigger?: number;
}

interface UsageData {
    usage: number;
    limit: number;
    remaining: number;
    resetIn: string;
    allowed: boolean;
}

export default function TokenUsageIndicator({ userEmail, onQuotaExhausted, refreshTrigger = 0 }: TokenUsageIndicatorProps) {
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUsage = async () => {
        try {
            const res = await fetch('/api/admin/questions/extract', {
                method: 'GET',
                headers: {
                    'X-User-Email': userEmail
                }
            });

            if (res.ok) {
                const data = await res.json();
                setUsageData(data);

                if (!data.allowed && onQuotaExhausted) {
                    onQuotaExhausted();
                }
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userEmail) {
            fetchUsage();
            // Refresh every minute
            const interval = setInterval(fetchUsage, 60000);
            return () => clearInterval(interval);
        }
    }, [userEmail, refreshTrigger]);

    if (loading || !usageData) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-700 rounded" />
            </div>
        );
    }

    const percentage = (usageData.usage / usageData.limit) * 100;
    const isNearLimit = percentage >= 80;
    const isAtLimit = !usageData.allowed;

    return (
        <div className={`
      border rounded-lg p-4 transition-all
      ${isAtLimit
                ? 'bg-red-900/20 border-red-500/50'
                : isNearLimit
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : 'bg-gray-800 border-gray-700'}
    `}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Zap className={`h-4 w-4 ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-blue-400'}`} />
                    <h4 className="text-sm font-bold text-white">Global API Usage</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>Resets in {usageData.resetIn}</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-400">
                        {usageData.usage} / {usageData.limit} requests
                    </span>
                    <span className={`font-bold ${isAtLimit ? 'text-red-400' :
                        isNearLimit ? 'text-yellow-400' :
                            'text-green-400'
                        }`}>
                        {usageData.remaining} remaining
                    </span>
                </div>

                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${isAtLimit
                            ? 'bg-red-500'
                            : isNearLimit
                                ? 'bg-yellow-500'
                                : 'bg-gradient-to-r from-green-500 to-blue-500'
                            }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
            </div>

            {/* Warning Messages */}
            {isAtLimit && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-300 bg-red-900/30 rounded p-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold mb-1">Daily limit reached!</p>
                        <p>Please use the manual entry method below or wait for {usageData.resetIn} for automatic reset.</p>
                    </div>
                </div>
            )}

            {isNearLimit && !isAtLimit && (
                <div className="mt-3 flex items-start gap-2 text-xs text-yellow-300 bg-yellow-900/30 rounded p-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p>You're approaching your daily limit. Consider using manual entry for small batches.</p>
                </div>
            )}

        </div>
    );
}
