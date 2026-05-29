import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function GET() {
    await connectDB();
    const students = await Student.find({}).sort({ roll: 1 });
    return NextResponse.json(students);
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const data = await req.json();

        // Basic validation
        if (!data.email || !data.name || !data.roll || !data.department || !data.year || !data.course_code) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check duplicate: Same Roll AND Same Course
        const existing = await Student.findOne({
            roll: data.roll,
            course_code: data.course_code
        });

        if (existing) {
            return NextResponse.json({ error: 'Student already registered for this course' }, { status: 400 });
        }

        // Default password is roll number
        const hashedPassword = await bcrypt.hash(data.roll, 10);

        const student = await Student.create({
            ...data,
            password: hashedPassword,
        });

        return NextResponse.json({ message: 'Student added', student });
    } catch (error: any) {
        console.error('Add student error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
