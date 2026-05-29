import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, password } = await req.json();

        // Find student by institute email or secondary email or roll
        // The legacy app used institute email or roll for "ID" input, but also had secondary email flow.
        // We'll support email (institute or secondary) and roll.
        const student = await Student.findOne({
            $or: [
                { email: email },
                { roll: email }
            ]
        });

        if (!student) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        if (!student.isVerified) {
            return NextResponse.json(
                { error: 'Account not registered. Please register first.' },
                { status: 403 }
            );
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Aggregate all courses for this student (Roll Number)
        // Since we are moving to "One Doc Per Course", we need to fetch all docs with same Roll
        const allEnrollments = await Student.find({ roll: student.roll });

        // Filter out enrollments where login is disabled
        const activeEnrollments = allEnrollments.filter(s => !s.loginDisabled);

        const courses = [...new Set(activeEnrollments.map(s => s.course_code).filter(Boolean))];

        return NextResponse.json({
            user: {
                id: student._id, // Primary ID (of the first doc found)
                name: student.name,
                email: student.email,
                secondary_email: student.secondary_email,
                roll: student.roll,
                department: student.department, // Assuming Dept/Year are consistent across enrollments
                year: student.year,
                course_code: courses, // Return Array of strings
                role: 'student',
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
