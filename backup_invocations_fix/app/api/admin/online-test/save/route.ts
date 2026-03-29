import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        // Get user email from headers (consistent with other routes)
        const userEmail = req.headers.get('X-User-Email');
        const isGlobalAdmin = req.headers.get('X-Global-Admin-Key') === 'globaladmin_25';

        if (!userEmail && !isGlobalAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        console.log('Save Test Payload:', JSON.stringify(body, null, 2)); // DEBUG
        const { _id, title, description, questions, deployment, config, randomization, status } = body;

        // Basic Validation
        if (!title || !questions || questions.length === 0) {
            console.error('Validation Failed: Title or Questions missing');
            return NextResponse.json({ error: 'Title and at least one question are required.' }, { status: 400 });
        }

        // Use header email as createdBy (the actual fix)
        const createdByEmail = userEmail || 'admin';

        let test;
        if (_id) {
            // Update existing test
            test = await OnlineTest.findByIdAndUpdate(_id, {
                title,
                description,
                questions,
                deployment,
                config,
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
                config,
                randomization,
                status: status || 'draft',
                createdBy: createdByEmail,
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
