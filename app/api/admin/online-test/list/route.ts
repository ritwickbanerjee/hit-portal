import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await connectDB();
        const tests = await OnlineTest.find({}).sort({ createdAt: -1 });
        return NextResponse.json({ tests });
    } catch (error) {
        console.error('Error fetching online tests:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}
