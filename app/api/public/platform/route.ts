import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Config from '@/models/Config';

export const revalidate = 0; // Ensure fresh data on Edge
export const maxDuration = 10;

export async function GET(req: Request) {
    try {
        await connectDB();
        const config = await Config.findOne({}).lean() as any;
        
        const response = NextResponse.json({ activePlatform: config?.activePlatform || 'vercel' });
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return response;
    } catch (error) {
        console.error("Public API Platform error:", error);
        const errFallback = NextResponse.json({ activePlatform: 'vercel' }, { status: 500 });
        errFallback.headers.set('Access-Control-Allow-Origin', '*');
        return errFallback;
    }
}

export async function OPTIONS(req: Request) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
}
