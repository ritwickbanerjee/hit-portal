import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, email, password } = await req.json();

        // 1. Find student by Roll Number
        const student = await Student.findOne({ roll });

        if (!student) {
            return NextResponse.json(
                { error: 'Student not found. Please contact Admin.' },
                { status: 404 }
            );
        }

        // 2. Verify Email matches
        if (student.email !== email.toLowerCase()) {
            return NextResponse.json(
                { error: 'Email does not match our records for this Roll Number.' },
                { status: 400 }
            );
        }

        // 3. Check if already registered
        if (student.isVerified) {
            return NextResponse.json(
                { error: 'Account already registered. Please login.' },
                { status: 400 }
            );
        }

        // 4. Update details
        const hashedPassword = await bcrypt.hash(password, 10);

        student.password = hashedPassword;
        student.isVerified = true;
        // secondary_email is discarded
        await student.save();

        return NextResponse.json({
            message: 'Registration successful. You can now login.',
            student: {
                id: student._id,
                name: student.name,
                email: student.email,
            },
        });
    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
