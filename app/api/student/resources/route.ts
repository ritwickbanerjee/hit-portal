import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Resource from '@/models/Resource';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const department = searchParams.get('department');
        const year = searchParams.get('year');
        const course_code = searchParams.get('course_code');



        if (!department || !year) {
            return NextResponse.json({ error: 'Department and Year are required' }, { status: 400 });
        }

        const studentId = req.headers.get('x-user-id');

        // 1. Validate Course Enrollment (Server-Side)
        let activeCourseCodes: string[] = [];
        if (studentId) {
            const currentStudent = await Student.findById(studentId);
            if (currentStudent) {
                const allStudentDocs = await Student.find({
                    roll: currentStudent.roll,
                    loginDisabled: { $ne: true }
                });
                activeCourseCodes = allStudentDocs
                    .map(s => s.course_code)
                    .filter(code => code && !code.startsWith('DISABLED_'));
            }
        }

        const requestedCodes = course_code ? course_code.split(',') : [];
        // Only allow requesting courses that are actually active
        const validCourseCodes = requestedCodes.filter(code => activeCourseCodes.includes(code));

        // Query resources - matching department, year, and optionally course
        const query: any = {
            $or: [
                { targetDepartments: department },
                { targetDepartments: { $in: [department] } }
            ],
            targetYear: year,
            ...(validCourseCodes.length > 0 ? { targetCourse: { $in: validCourseCodes } } : {})
        };

        let resources = await Resource.find(query).sort({ createdAt: -1 });

        // Double check: Filter out any resource that targets a course NOT in activeCourseCodes
        // Only if we have activeCourseCodes (authenticated user)
        if (activeCourseCodes.length > 0) {
            resources = resources.filter(r => {
                if (!r.targetCourse) return true; // General resource
                return activeCourseCodes.includes(r.targetCourse);
            });
        }


        // Fallback logic removed to prevent unauthorized access to all resources
        // if (resources.length === 0) { ... }

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Fetch Resources Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
