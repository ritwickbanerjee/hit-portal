'use client';

import { useEffect } from 'react';

export default function PlatformRedirect() {
    useEffect(() => {
        const checkPlatform = async () => {
            try {
                // ALWAYS fetch from Vercel explicitly to bypass Netlify quota limits
                // Even when on Netlify, this ensures we don't hit 522/Timeout because of free limits.
                const res = await fetch('https://hit-portal.vercel.app/api/public/platform', {
                    cache: 'no-store'
                });
                
                if (!res.ok) return;

                const data = await res.json();
                const activePlatform = data?.activePlatform || 'vercel';
                const hostname = window.location.hostname;
                
                if (activePlatform === "vercel" && hostname.includes("netlify.app")) {
                    window.location.href = "https://hit-portal.vercel.app" + window.location.pathname + window.location.search;
                } else if (activePlatform === "netlify" && hostname.includes("vercel.app")) {
                    window.location.href = "https://hit-portal.netlify.app" + window.location.pathname + window.location.search;
                }
            } catch (e) {
                console.error("Platform check failed", e);
            }
        };
        
        checkPlatform();
    }, []);

    return null;
}
