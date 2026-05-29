import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll } = await req.json();

        if (!roll) {
            return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });

        if (!student) {
            return NextResponse.json({ status: 'not_found', message: 'Student not found' }, { status: 404 });
        }

        if (student.isVerified) {
            return NextResponse.json({ status: 'registered', message: 'Student already registered' });
        }

        return NextResponse.json({ status: 'unregistered', message: 'Student found, proceed to registration' });
    } catch (error) {
        console.error('Check Roll Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
