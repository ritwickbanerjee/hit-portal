import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { _id, deployment, config } = body;

        if (!_id) {
            return NextResponse.json({ error: 'Test ID is required for deployment.' }, { status: 400 });
        }

        // Validate Deployment Details
        if (!deployment ||
            !deployment.department ||
            (Array.isArray(deployment.department) && deployment.department.length === 0) ||
            !deployment.year ||
            !deployment.course ||
            !deployment.startTime ||
            !deployment.endTime ||
            !deployment.durationMinutes) {
            return NextResponse.json({ error: 'Incomplete deployment details.' }, { status: 400 });
        }

        // Update Test Status and Deployment Details
        const test = await OnlineTest.findByIdAndUpdate(_id, {
            deployment,
            config,
            status: 'deployed',
            updatedAt: new Date()
        }, { new: true });

        if (!test) {
            return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, test });
    } catch (error) {
        console.error('Error deploying online test:', error);
        return NextResponse.json({ error: 'Failed to deploy test' }, { status: 500 });
    }
}
