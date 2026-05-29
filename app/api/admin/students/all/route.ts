import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function GET() {
    try {
        await connectDB();
        const students = await Student.find({}).sort({ createdAt: -1 });

        // GLOBAL FIX: Sanitize course_code for Admin UI
        // We strip 'DISABLED_' prefix so the Admin UI (Dashboard, Attendance, etc.) 
        // sees the original course code and can correctly filter/assign students.
        // The 'loginDisabled' flag is sufficient for the UI to show status.
        const sanitizedStudents = students.map(s => {
            const doc = s.toObject();
            if (doc.course_code && doc.course_code.startsWith('DISABLED_')) {
                doc.course_code = doc.course_code.replace('DISABLED_', '');
            }
            return doc;
        });

        return NextResponse.json(sanitizedStudents);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
