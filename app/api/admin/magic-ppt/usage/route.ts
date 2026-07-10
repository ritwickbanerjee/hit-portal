import { NextRequest } from 'next/server';
import { incrementUsage } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const { tokens } = await req.json();
        if (tokens) {
            await incrementUsage(tokens);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
