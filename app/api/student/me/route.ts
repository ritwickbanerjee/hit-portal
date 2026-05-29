import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();

        // Middleware already validates and sets x-user-id.
        const studentId = req.headers.get('x-user-id');

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find primary student to get roll number (lean = no Mongoose hydration overhead)
        const student = await Student.findById(studentId).lean() as any;
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Single consolidated query: get all records for this roll (covers multi-course enrollment)
        const allStudentDocs = await Student.find({ roll: student.roll }).lean() as any[];

        // Check if ALL accounts are disabled
        const allDisabled = allStudentDocs.every((doc: any) => doc.loginDisabled);
        if (allDisabled) {
            return NextResponse.json(
                { error: 'Your account has been disabled. Contact admin.' },
                { status: 403 }
            );
        }

        // Filter only ACTIVE courses â€” exclude loginDisabled and 'DISABLED_' prefixed codes
        const activeStudentDocs = allStudentDocs.filter((doc: any) => !doc.loginDisabled);
        const allCourseCodes = activeStudentDocs
            .map((doc: any) => doc.course_code)
            .filter((code: string) => code && !code.startsWith('DISABLED_'));

        const response = NextResponse.json({
            _id: student._id,
            roll: student.roll,
            name: student.name,
            email: student.email,
            department: student.department,
            year: student.year,
            course_code: allCourseCodes,
            role: 'student',
        });
        // Safe to cache privately per-user for 60 s â€” profile data rarely changes mid-session
        response.headers.set('Cache-Control', 'private, max-age=60');
        return response;

    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
