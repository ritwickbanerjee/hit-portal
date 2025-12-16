import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { studentId, disabled } = await req.json();

        if (!studentId || typeof disabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const student = await Student.findByIdAndUpdate(
            studentId,
            { loginDisabled: disabled },
            { new: true }
        );

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({
            message: `Student login ${disabled ? 'disabled' : 'enabled'} successfully`,
            student
        });

    } catch (error) {
        console.error('Status Toggle Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
