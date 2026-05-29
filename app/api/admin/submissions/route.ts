import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Submission from '@/models/Submission';
import Student from '@/models/Student'; // Ensure model is registered
import Assignment from '@/models/Assignment'; // Ensure model is registered

export const runtime = 'nodejs';

export async function GET() {
    try {
        await connectDB();
        // Ensure models are registered before populating
        // (Mongoose sometimes needs this if models haven't been used yet in this process)
        const _s = Student;
        const _a = Assignment;

        const submissions = await Submission.find({})
            .populate('student', 'name email')
            .populate('assignment', 'title')
            .sort({ submittedAt: -1 });

        return NextResponse.json(submissions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
