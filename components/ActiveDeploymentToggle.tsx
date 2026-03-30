'use client';

import { useState, useEffect } from 'react';
import { Server, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ActiveDeploymentToggle({ userEmail }: { userEmail: string }) {
    const [platform, setPlatform] = useState<'vercel' | 'netlify'>('vercel');
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    useEffect(() => {
        if (userEmail !== 'ritwick92@gmail.com') return;

        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/admin/config', {
                    headers: { 'X-User-Email': userEmail }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.activePlatform) {
                        setPlatform(data.activePlatform);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch platform config', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, [userEmail]);

    if (userEmail !== 'ritwick92@gmail.com') return null;

    const togglePlatform = async () => {
        setToggling(true);
        const newPlatform = platform === 'vercel' ? 'netlify' : 'vercel';
        const toastId = toast.loading(`Switching routing to ${newPlatform}...`);
        
        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST', // The config route uses POST for updates
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail
                },
                body: JSON.stringify({ activePlatform: newPlatform }) // Keep other fields untouched by only sending what changed? Wait, the API uses findOneAndUpdate with $set so it's a merge!
            });

            if (res.ok) {
                setPlatform(newPlatform);
                toast.success(`Traffic now routed to ${newPlatform}`, { id: toastId });
            } else {
                throw new Error('Failed to update platform');
            }
        } catch (error) {
            toast.error('Failed to switch platform', { id: toastId });
        } finally {
            setToggling(false);
        }
    };

    if (loading) return null;

    return (
        <button
            onClick={togglePlatform}
            disabled={toggling}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
            <div className="flex items-center gap-2">
                {toggling ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <Server className="h-4 w-4 text-indigo-400" />}
                <span>Active Routing</span>
            </div>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${platform === 'vercel' ? 'bg-black text-white border border-white/20' : 'bg-[#00C7B7]/20 text-[#00C7B7] border border-[#00C7B7]/50'}`}>
                {platform}
            </span>
        </button>
    );
}
