'use client';

import { useEffect, useState } from 'react';
import { Download, GraduationCap, ClipboardCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface InstallPWAProps {
    type: 'student' | 'admin';
}

export default function InstallPWA({ type }: InstallPWAProps) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already in PWA mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        // Check for iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (isIOS) {
            toast('To install: Tap "Share" → "Add to Home Screen"', {
                icon: '📱',
                duration: 5000
            });
            return;
        }

        if (!deferredPrompt) {
            toast('App installation not ready yet. Try again in a moment or use browser menu.', {
                icon: '⏳',
            });
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsInstalled(true);
        }
    };

    // if (isInstalled) return null; // keep verification easy for now
    // if (!deferredPrompt && !isIOS) return null; 

    // Helper to determine if we should show button:
    // For specific user request, let's ALWAYS show it but give feedback if not ready.
    // In production, you might want to hide it if (isInstalled).

    if (isInstalled) {
        if (type === 'admin') return null; // Admin header doesn't need "App Installed" text
        return (
            <div className="flex justify-center mt-6 mb-8 text-gray-500 text-xs">
                App Installed
            </div>
        );
    }

    if (type === 'student') {
        return (
            <div className="flex justify-center mt-6 mb-8 animate-in fade-in zoom-in duration-500">
                <button
                    onClick={handleInstall}
                    className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95 group"
                >
                    <div className="p-1.5 bg-white/20 rounded-full">
                        <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-200">Get the App</p>
                        <p className="text-sm font-bold leading-none">Install Portal</p>
                    </div>
                    <Download className="h-4 w-4 text-white/70 group-hover:text-white transition-colors ml-1" />
                </button>
            </div>
        );
    }

    if (type === 'admin') {
        // Only show admin header button if actually inst-allable (or iOS instructions)
        // This prevents the "Not ready" toast frustration
        if (!deferredPrompt && !isIOS) return null;

        return (
            <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all text-xs font-medium ml-3 animate-in fade-in zoom-in"
            >
                <ClipboardCheck className="h-4 w-4" />
                <span>Install App</span>
            </button>
        );
    }

    return null;
}
