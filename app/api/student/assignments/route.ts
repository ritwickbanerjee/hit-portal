import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';
import Submission from '@/models/Submission';
import Student from '@/models/Student';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const department = searchParams.get('department');
        const year = searchParams.get('year');
        const course_code = searchParams.get('course_code');
        // Get studentId from SECURE HEADERS (injected by middleware) - PREVENT IDOR
        // We ignore the query param 'studentId' sent by client for security.
        const studentId = req.headers.get('x-user-id');



        if (!department || !year || !studentId) {
            return NextResponse.json({ error: 'Department, Year, and Auth are required' }, { status: 400 });
        }

        // 1. Validate Course Enrollment (Server-Side)
        // Fetch student's ACTUAL active courses from DB to prevent accessing disabled courses
        const currentStudent = await Student.findById(studentId);
        if (!currentStudent) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Find all active course codes for this student (same roll)
        // Exclude any that start with 'DISABLED_' or where loginDisabled is true
        const allStudentDocs = await Student.find({
            roll: currentStudent.roll,
            loginDisabled: { $ne: true }
        });

        const activeCourseCodes = allStudentDocs
            .map(s => s.course_code)
            .filter(code => code && !code.startsWith('DISABLED_'));

        // Filter the requested course codes against the active list
        const requestedCodes = course_code ? course_code.split(',') : [];
        const validCourseCodes = requestedCodes.filter(code => activeCourseCodes.includes(code));

        // If specific courses requested but none are valid, return empty (or just general dept/year ones)
        // But usually we want to restrict to ONLY valid courses if courses are specified.

        const query: any = {
            targetDepartments: department,
            $or: [
                { targetYear: year },
                ...(validCourseCodes.length > 0 ? [{ targetCourse: { $in: validCourseCodes } }] : [])
            ]
        };

        // CRITICAL: If courses WERE requested but NONE are valid, ensure we don't accidentally show all courses
        // However, the query above falls back to just Dept/Year if validCourseCodes is empty. 
        // We should explicitly exclude courses that are NOT in the active list if they were targeted.
        // Actually, safer approach: Always enforce that targetCourse must be in activeCourseCodes if it exists.

        // Refined Query:
        // 1. Matches Dept & Year
        // 2. AND (TargetCourse is Empty/Null OR TargetCourse is in ActiveList)
        // But the current schema uses `targetCourse` string.

        // Let's stick to the previous logic but with validCourseCodes. 
        // If the user asked for CS301 and it's disabled, validCourseCodes excludes it.
        // The query then becomes "Dept=CSE AND Year=3rd". This might show assignments meant for "All CSE 3rd".
        // This is acceptable. We just don't want to show "CS301" specific assignments.

        let assignments = await Assignment.find(query).sort({ createdAt: -1 });

        // Double check: Filter out any assignment that targets a course NOT in activeCourseCodes
        assignments = assignments.filter(a => {
            if (!a.targetCourse) return true; // General assignment
            return activeCourseCodes.includes(a.targetCourse);
        });

        // 2. If studentId provided, also fetch personalized assignments
        if (studentId) {
            const currentStudent = await Student.findById(studentId);
            let allStudentIds = [studentId];

            if (currentStudent) {
                const allDocs = await Student.find({ roll: currentStudent.roll, loginDisabled: { $ne: true } });
                allStudentIds = allDocs.map(d => d._id.toString());
            }

            const studentAssignments = await StudentAssignment.find({
                studentId: { $in: allStudentIds }
            }).populate('assignmentId');

            const personalizedAssignmentIds = studentAssignments
                .filter((sa: any) => sa.assignmentId)
                .map((sa: any) => sa.assignmentId._id);

            if (personalizedAssignmentIds.length > 0) {
                const personalizedAssignments = await Assignment.find({
                    _id: { $in: personalizedAssignmentIds },
                    type: 'personalized'
                });
                assignments = [...assignments, ...personalizedAssignments];
            }
        }

        // 3. Remove duplicates
        const uniqueAssignments = Array.from(
            new Map(assignments.map(a => [a._id.toString(), a])).values()
        );

        // 4. Attach submission status
        let assignmentsWithSubmissions = uniqueAssignments;

        if (studentId) {
            const currentStudent = await Student.findById(studentId);
            let allStudentIds: any[] = [studentId];
            if (currentStudent) {
                const allDocs = await Student.find({ roll: currentStudent.roll, loginDisabled: { $ne: true } });
                allStudentIds = allDocs.map(d => d._id);
            }



            const submissions = await Submission.find({
                student: studentId,
                assignment: { $in: uniqueAssignments.map((a: any) => a._id) }
            });



            const submissionMap = new Map(
                submissions.map(s => [s.assignment.toString(), s])
            );

            assignmentsWithSubmissions = uniqueAssignments.map((assignment: any) => {
                const submission = submissionMap.get(assignment._id.toString());

                return {
                    ...assignment.toObject(),
                    submitted: !!submission,
                    submissionData: submission ? {
                        driveLink: submission.driveLink,
                        submittedAt: submission.submittedAt
                    } : null
                };
            });
        }

        return NextResponse.json(assignmentsWithSubmissions);
    } catch (error) {
        console.error('Fetch Assignments Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
