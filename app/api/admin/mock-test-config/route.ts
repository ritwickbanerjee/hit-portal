import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export async function GET(req: Request) {
    try {
        await connectDB();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[MOCK TEST CONFIG GET] Looking for user:', userEmail);

        // Find config by userEmail (more reliable than facultyName)
        let config = await MockTestConfig.findOne({ userEmail }).catch(err => {
            console.error('[MOCK TEST CONFIG GET] DB Error:', err);
            return null;
        });

        console.log('[MOCK TEST CONFIG GET] Found config:', config);

        if (!config) {
            console.log('[MOCK TEST CONFIG GET] No config found, returning empty');
            return NextResponse.json({ topics: [], facultyName: '' });
        }

        return NextResponse.json({
            facultyName: config.facultyName || '',
            topics: config.topics || []
        });
    } catch (error: any) {
        console.error('[MOCK TEST CONFIG GET] Error:', error);
        console.error('[MOCK TEST CONFIG GET] Stack:', error?.stack);
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

        console.log('[MOCK TEST CONFIG POST] Saving for user:', userEmail);
        console.log('[MOCK TEST CONFIG POST] Faculty name:', facultyName);
        console.log('[MOCK TEST CONFIG POST] Topics count:', topics?.length);

        // Upsert config using userEmail as key (more reliable)
        const config = await MockTestConfig.findOneAndUpdate(
            { userEmail },
            { userEmail, facultyName, topics },
            { upsert: true, new: true }
        );

        console.log('[MOCK TEST CONFIG POST] Saved successfully');

        return NextResponse.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('[MOCK TEST CONFIG POST] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
