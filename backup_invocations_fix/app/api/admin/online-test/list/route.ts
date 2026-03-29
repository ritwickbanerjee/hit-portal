import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await connectDB();
        const userEmail = req.headers.get('X-User-Email');
        const isGlobalAdmin = req.headers.get('X-Global-Admin-Key') === 'globaladmin_25';

        let query: any = {};
        if (!isGlobalAdmin) {
            if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            // Use case-insensitive match for createdBy to avoid disappearing tests due to email casing
            query = { createdBy: { $regex: new RegExp(`^${userEmail}$`, 'i') } };
        }

        const tests = await OnlineTest.find(query).sort({ createdAt: -1 });
        return NextResponse.json({ tests });
    } catch (error) {
        console.error('Error fetching online tests:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}
