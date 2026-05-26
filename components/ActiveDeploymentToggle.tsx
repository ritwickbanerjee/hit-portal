'use client';

import { useState, useEffect } from 'react';
import { Server, Loader2, Globe, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ActiveDeploymentToggle({ userEmail }: { userEmail: string }) {
    const [platform, setPlatform] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                        setInputUrl(data.activePlatform);
                    } else {
                        setPlatform('vercel');
                        setInputUrl('vercel');
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

    const savePlatform = async (urlToSave: string) => {
        if (!urlToSave.trim()) return;
        setSaving(true);
        const toastId = toast.loading(`Updating routing destination...`);
        
        try {
            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail
                },
                body: JSON.stringify({ activePlatform: urlToSave.trim() })
            });

            if (res.ok) {
                setPlatform(urlToSave.trim());
                setInputUrl(urlToSave.trim());
                toast.success(`Traffic successfully routed!`, { id: toastId });
            } else {
                throw new Error('Failed to update platform');
            }
        } catch (error) {
            toast.error('Failed to switch platform', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    const isPreset = platform === 'vercel' || platform === 'netlify' || platform === 'hit-portal-six.vercel.app';

    return (
        <div className="bg-slate-900/50 backdrop-blur-md rounded-xl border border-indigo-500/20 p-4 mb-4 shadow-lg shadow-indigo-900/10">
            <div className="flex items-center gap-2 mb-3 text-indigo-300">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Traffic Routing</span>
            </div>
            
            <div className="space-y-3">
                <div className="text-xs text-slate-400">Quick Select:</div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => savePlatform('https://hit-portal.vercel.app')}
                        disabled={saving}
                        className={`text-[10px] uppercase font-bold px-2 py-1.5 rounded transition-all ${
                            platform === 'https://hit-portal.vercel.app' || platform === 'vercel' 
                                ? 'bg-black text-white border-2 border-white' 
                                : 'bg-black/40 text-slate-400 border border-white/20 hover:border-white/50 hover:text-white'
                        }`}
                    >
                        Vercel 1 (Main)
                    </button>
                    <button
                        onClick={() => savePlatform('https://hit-portal-six.vercel.app')}
                        disabled={saving}
                        className={`text-[10px] uppercase font-bold px-2 py-1.5 rounded transition-all ${
                            platform === 'https://hit-portal-six.vercel.app' 
                                ? 'bg-black text-white border-2 border-white' 
                                : 'bg-black/40 text-slate-400 border border-white/20 hover:border-white/50 hover:text-white'
                        }`}
                    >
                        Vercel 2 (Six)
                    </button>
                    <button
                        onClick={() => savePlatform('https://maths-hit-attendance-assignment-track.netlify.app')}
                        disabled={saving}
                        className={`col-span-2 text-[10px] uppercase font-bold px-2 py-1.5 rounded transition-all ${
                            platform === 'https://maths-hit-attendance-assignment-track.netlify.app' || platform === 'netlify'
                                ? 'bg-[#00C7B7]/20 text-[#00C7B7] border-2 border-[#00C7B7]' 
                                : 'bg-black/40 text-slate-400 border border-white/20 hover:border-[#00C7B7]/50 hover:text-[#00C7B7]'
                        }`}
                    >
                        Netlify (0 Credits)
                    </button>
                </div>

                <div className="pt-2 border-t border-white/10">
                    <div className="text-xs text-slate-400 mb-2">Custom URL:</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="https://new-domain.vercel.app"
                            className="flex-1 rounded-lg border border-white/10 bg-black/50 py-1.5 px-3 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <button
                            onClick={() => savePlatform(inputUrl)}
                            disabled={saving || !inputUrl || inputUrl === platform}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-3 py-1.5 flex items-center justify-center transition-all"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
