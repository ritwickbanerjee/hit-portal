import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { testId } = await request.json();

        if (!testId) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find original test
        const originalTest = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });

        if (!originalTest) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Create new test object
        const newTest = new OnlineTest({
            title: `${originalTest.title} (Copy)`,
            description: originalTest.description,
            questions: originalTest.questions, // Should be array of objects or IDs depending on schema
            totalMarks: originalTest.totalMarks,
            createdBy: userEmail,
            folderId: originalTest.folderId, // Keep in same folder? Yes.
            status: 'draft',
            deployment: undefined // Clear deployment
        });

        await newTest.save();

        return NextResponse.json({ message: 'Test cloned successfully', test: newTest });

    } catch (error) {
        console.error('Error cloning test:', error);
        return NextResponse.json({ error: 'Failed to clone test' }, { status: 500 });
    }
}
