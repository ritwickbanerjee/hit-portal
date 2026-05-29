import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Config from '@/models/Config';

export const runtime = 'nodejs';

// Cache for 60 seconds at the edge; revalidate in background for up to 5 minutes.
// The active platform changes very rarely â€” no need for a fresh DB query per request.
export const revalidate = 60;
export const maxDuration = 10;

export async function GET(req: Request) {
    try {
        await connectDB();
        const config = await Config.findOne({}).lean() as any;

        const response = NextResponse.json({ activePlatform: config?.activePlatform || 'vercel' });
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        // Tell browsers and the CDN edge to cache this for 60 s and serve stale for 5 min while revalidating.
        response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

        return response;
    } catch (error) {
        console.error("Public API Platform error:", error);
        const errFallback = NextResponse.json({ activePlatform: 'vercel' }, { status: 500 });
        errFallback.headers.set('Access-Control-Allow-Origin', '*');
        // Don't cache errors
        errFallback.headers.set('Cache-Control', 'no-store');
        return errFallback;
    }
}

export async function OPTIONS(req: Request) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Cache-Control', 'public, s-maxage=86400');
    return response;
}
