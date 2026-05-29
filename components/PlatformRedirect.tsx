'use client';

import { useEffect } from 'react';

// Cache TTL: 5 minutes. The platform rarely changes; no need to hit the edge on every navigation.
const PLATFORM_CACHE_KEY = 'platform_redirect_origin';
const PLATFORM_CACHE_TS_KEY = 'platform_redirect_ts';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default function PlatformRedirect() {
    useEffect(() => {
        const checkPlatform = async () => {
            try {
                const currentOrigin = window.location.origin;

                // --- Session cache: skip the network if we have a fresh result ---
                const cachedOrigin = sessionStorage.getItem(PLATFORM_CACHE_KEY);
                const cachedTs = Number(sessionStorage.getItem(PLATFORM_CACHE_TS_KEY) || '0');
                if (cachedOrigin && Date.now() - cachedTs < CACHE_TTL_MS) {
                    // We already know where to go — redirect if needed, otherwise do nothing.
                    if (currentOrigin !== cachedOrigin) {
                        window.location.href = cachedOrigin + window.location.pathname + window.location.search;
                    }
                    return;
                }

                // --- Fresh fetch (only runs once per 5 minutes per session) ---
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
                        // Use default caching (not no-store) so the browser and CDN can cache too.
                        const res = await fetch(ep);
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

                if (activePlatformStr === 'none' || activePlatformStr === 'disabled') {
                    sessionStorage.setItem(PLATFORM_CACHE_KEY, currentOrigin);
                    sessionStorage.setItem(PLATFORM_CACHE_TS_KEY, String(Date.now()));
                    return;
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

                // Store result in sessionStorage so subsequent navigations skip the fetch.
                sessionStorage.setItem(PLATFORM_CACHE_KEY, targetOrigin);
                sessionStorage.setItem(PLATFORM_CACHE_TS_KEY, String(Date.now()));

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
