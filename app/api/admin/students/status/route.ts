import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { studentId, disabled } = await req.json();

        if (!studentId || typeof disabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const studentToUpdate = await Student.findById(studentId);
        if (!studentToUpdate) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        let newCourseCode = studentToUpdate.course_code;
        if (disabled) {
            if (!newCourseCode.startsWith('DISABLED_')) {
                newCourseCode = `DISABLED_${newCourseCode}`;
            }
        } else {
            if (newCourseCode.startsWith('DISABLED_')) {
                newCourseCode = newCourseCode.replace('DISABLED_', '');
            }
        }

        const student = await Student.findByIdAndUpdate(
            studentId,
            {
                loginDisabled: disabled,
                course_code: newCourseCode
            },
            { new: true }
        );

        return NextResponse.json({
            message: `Student login ${disabled ? 'disabled' : 'enabled'} successfully`,
            student
        });

    } catch (error) {
        console.error('Status Toggle Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
