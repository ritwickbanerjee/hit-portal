'use client';

// PlatformRedirect is intentionally disabled.
// Date-based portal switching is fully handled by middleware.ts which
// redirects server-side based on the day of the month (IST).
// This client-side component previously caused conflicts by reading a
// stale DB value ("vercel") and redirecting to a non-existent domain.

export default function PlatformRedirect() {
    return null;
}
