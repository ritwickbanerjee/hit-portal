import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import HtmlSubmission from '@/models/HtmlSubmission';

export const runtime = 'nodejs';

// GET — fetch all submissions for a given resourceId
// ?resourceId=xxx
export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const resourceId = searchParams.get('resourceId');

        if (!resourceId) {
            return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
        }

        const submissions = await HtmlSubmission.find({ resourceId })
            .sort({ submittedAt: 1 })
            .lean();

        return NextResponse.json(submissions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
