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
            return NextResponse.json({ error: 'Roll number not found. Please contact Admin.' }, { status: 404 });
        }

        if (student.isVerified) {
            return NextResponse.json({ error: 'Account already registered. Please login.' }, { status: 400 });
        }

        return NextResponse.json({ message: 'Roll number verified', valid: true });
    } catch (error: any) {
        console.error('Verify Roll error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
