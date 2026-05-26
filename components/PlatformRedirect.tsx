'use client';

import { useEffect } from 'react';

export default function PlatformRedirect() {
    useEffect(() => {
        const checkPlatform = async () => {
            try {
                const currentOrigin = window.location.origin;
                
                // Endpoints to try sequentially. 
                // We DO NOT add Netlify domains here to ensure 0 Netlify function invocations.
                const endpoints = [
                    'https://hit-portal-six.vercel.app/api/public/platform',
                    'https://hit-portal.vercel.app/api/public/platform'
                ];

                // If current domain is NOT Netlify, we add it to the top of the list 
                // so that newly set active platforms can be queried from themselves.
                if (!currentOrigin.includes('netlify')) {
                    endpoints.unshift(currentOrigin + '/api/public/platform');
                }

                let activePlatformStr = 'vercel';

                for (const ep of endpoints) {
                    try {
                        const res = await fetch(ep, { cache: 'no-store' });
                        if (res.ok) {
                            const data = await res.json();
                            if (data?.activePlatform) {
                                activePlatformStr = data.activePlatform;
                                break;
                            }
                        }
                    } catch (e) {
                        // Suppress error and try next endpoint
                    }
                }

                // Resolve legacy strings to their actual domains
                let targetUrl = activePlatformStr;
                if (activePlatformStr === 'vercel') {
                    targetUrl = 'https://hit-portal.vercel.app';
                } else if (activePlatformStr === 'netlify') {
                    targetUrl = 'https://maths-hit-attendance-assignment-track.netlify.app';
                } else if (activePlatformStr === 'hit-portal-six.vercel.app') {
                    targetUrl = 'https://hit-portal-six.vercel.app';
                }

                // Ensure it starts with http
                if (!targetUrl.startsWith('http')) {
                    targetUrl = 'https://' + targetUrl;
                }

                const targetOrigin = new URL(targetUrl).origin;

                // Redirect if we are not on the active platform
                if (currentOrigin !== targetOrigin) {
                    window.location.href = targetOrigin + window.location.pathname + window.location.search;
                }

            } catch (e) {
                console.error("Platform check failed", e);
            }
        };
        
        checkPlatform();
    }, []);

    return null;
}
