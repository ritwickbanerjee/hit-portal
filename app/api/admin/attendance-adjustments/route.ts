import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AttendanceAdjustment from '@/models/AttendanceAdjustment';
import Student from '@/models/Student';

export const runtime = 'nodejs';

// GET — fetch adjustments for a batch or student
export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const batchKey = searchParams.get('batchKey');
        const studentId = searchParams.get('studentId');
        const studentRoll = searchParams.get('studentRoll');
        const courseCode = searchParams.get('courseCode');

        const query: any = {};
        if (batchKey) query.batchKey = batchKey;
        if (studentId) query.studentId = studentId;
        if (studentRoll) query.studentRoll = studentRoll;
        if (courseCode) query.courseCode = courseCode;

        if (Object.keys(query).length === 0) {
            return NextResponse.json({ error: 'At least one filter is required' }, { status: 400 });
        }

        const adjustments = await AttendanceAdjustment.find(query).sort({ createdAt: -1 });
        return NextResponse.json(adjustments);
    } catch (error: any) {
        console.error('Get adjustments error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create a new adjustment entry
export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        const {
            studentId,
            studentRoll,
            studentName,
            facultyEmail,
            facultyName,
            courseCode,
            batchKey,
            date,
            delta,
            reason
        } = body;

        if (!studentId || !courseCode || !delta || delta < 1) {
            return NextResponse.json({ error: 'studentId, courseCode, and a positive delta are required' }, { status: 400 });
        }

        const adjustment = await AttendanceAdjustment.create({
            studentId,
            studentRoll: studentRoll || '',
            studentName: studentName || '',
            facultyEmail: facultyEmail || '',
            facultyName: facultyName || '',
            courseCode,
            batchKey: batchKey || '',
            date: date || '',
            delta: Math.abs(delta),
            reason: reason || ''
        });

        // Also update the Student aggregate field so existing APIs remain unaffected
        // Find the specific student doc for this course
        const student = await Student.findById(studentId);
        if (student) {
            const newAttendedAdj = (student.attended_adjustment || 0) + Math.abs(delta);
            await Student.findByIdAndUpdate(studentId, {
                attended_adjustment: newAttendedAdj
            });
        }

        return NextResponse.json(adjustment, { status: 201 });
    } catch (error: any) {
        console.error('Create adjustment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove an adjustment entry by id
export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Adjustment ID is required' }, { status: 400 });
        }

        const adjustment = await AttendanceAdjustment.findById(id);
        if (!adjustment) {
            return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
        }

        // Reverse the aggregate adjustment on the Student
        const student = await Student.findById(adjustment.studentId);
        if (student) {
            const newAttendedAdj = Math.max(0, (student.attended_adjustment || 0) - adjustment.delta);
            await Student.findByIdAndUpdate(adjustment.studentId, {
                attended_adjustment: newAttendedAdj
            });
        }

        await AttendanceAdjustment.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Adjustment deleted successfully' });
    } catch (error: any) {
        console.error('Delete adjustment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
