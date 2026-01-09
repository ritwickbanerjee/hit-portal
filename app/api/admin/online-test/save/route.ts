import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        console.log('Save Test Payload:', JSON.stringify(body, null, 2)); // DEBUG
        const { _id, title, description, questions, deployment, randomization, status, createdBy } = body;

        // Basic Validation
        if (!title || !questions || questions.length === 0) {
            console.error('Validation Failed: Title or Questions missing');
            return NextResponse.json({ error: 'Title and at least one question are required.' }, { status: 400 });
        }

        let test;
        if (_id) {
            // Update existing test
            test = await OnlineTest.findByIdAndUpdate(_id, {
                title,
                description,
                questions,
                deployment,
                randomization,
                status,
                updatedAt: new Date()
            }, { new: true });
        } else {
            // Create new test
            test = await OnlineTest.create({
                title,
                description,
                questions,
                deployment,
                randomization,
                status: status || 'draft',
                createdBy: createdBy || 'admin', // TODO: Get actual user from session
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        return NextResponse.json({ success: true, test });
    } catch (error) {
        console.error('Error saving online test:', error);
        return NextResponse.json({ error: 'Failed to save test: ' + (error as Error).message }, { status: 500 });
    }
}
