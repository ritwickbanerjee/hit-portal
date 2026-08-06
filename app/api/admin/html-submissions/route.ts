import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import HtmlSubmission from '@/models/HtmlSubmission';
import Student from '@/models/Student';

export const runtime = 'nodejs';

// GET — fetch all submissions for a given resourceId
// ?resourceId=xxx                         → plain list of submissions
// ?resourceId=xxx&dept=Y&year=Z&course=W  → full batch roster with submitted/not-submitted status
export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const resourceId = searchParams.get('resourceId');
        const dept       = searchParams.get('dept');
        const year       = searchParams.get('year');
        const course     = searchParams.get('course');

        if (!resourceId) {
            return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
        }

        // Fetch all submissions for this resource
        const submissions = await HtmlSubmission.find({ resourceId })
            .sort({ submittedAt: 1 })
            .lean();

        // If batch filter provided, also fetch full student roster for that batch
        if (dept && year && course) {
            const students = await Student.find(
                { department: dept, year, course_code: course },
                { name: 1, roll: 1, email: 1, department: 1, year: 1, course_code: 1 }
            ).sort({ roll: 1 }).lean();

            // Build a lookup: studentId → submission
            const submissionMap: Record<string, any> = {};
            submissions.forEach(s => {
                submissionMap[s.studentId.toString()] = s;
            });

            // Merge: for each student mark submitted/not
            const roster = students.map((s: any) => {
                const sub = submissionMap[s._id.toString()];
                return {
                    studentId:   s._id,
                    studentName: s.name,
                    studentRoll: s.roll,
                    studentEmail: s.email,
                    studentDepartment: s.department,
                    studentYear: s.year,
                    submitted:   !!sub,
                    submittedAt: sub ? sub.submittedAt : null,
                };
            });

            return NextResponse.json({ roster, submissionCount: submissions.length, totalStudents: students.length });
        }

        // Plain list
        return NextResponse.json(submissions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
