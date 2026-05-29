import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find config by userEmail (more reliable than facultyName)
        const config = await MockTestConfig.findOne({ userEmail }).lean().catch(() => null);

        if (!config) {
            return NextResponse.json({ topics: [], facultyName: '' });
        }

        return NextResponse.json({
            facultyName: (config as any).facultyName || '',
            topics: (config as any).topics || []
        });
    } catch (error: any) {
        console.error('[MOCK TEST CONFIG GET] Error:', error?.message);
        return NextResponse.json({ error: 'Server error', details: error?.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { facultyName, topics } = body;

        if (!facultyName) {
            return NextResponse.json({ error: 'Faculty name required' }, { status: 400 });
        }

        // Upsert config using userEmail as key (more reliable)
        const config = await MockTestConfig.findOneAndUpdate(
            { userEmail },
            { userEmail, facultyName, topics },
            { upsert: true, new: true }
        );

        return NextResponse.json({ success: true, config });
    } catch (error) {
        console.error('[MOCK TEST CONFIG POST] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
