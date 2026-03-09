import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

// GET - Fetch single test by ID
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const params = await props.params;
        const { id } = params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const test = await OnlineTest.findOne({ _id: id, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        return NextResponse.json(test);
    } catch (error: any) {
        console.error('Error fetching test:', error);
        return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 });
    }
}
