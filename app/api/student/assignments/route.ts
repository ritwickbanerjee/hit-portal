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

        // 1. Query batch/manual/randomized assignments that match student's department
        const courseCodes = course_code ? course_code.split(',') : [];
        const query: any = {
            targetDepartments: department,
            $or: [
                { targetYear: year },
                ...(courseCodes.length > 0 ? [{ targetCourse: { $in: courseCodes } }] : [])
            ]
        };

        let assignments = await Assignment.find(query).sort({ createdAt: -1 });

        // 2. If studentId provided, also fetch personalized assignments
        if (studentId) {
            const currentStudent = await Student.findById(studentId);
            let allStudentIds = [studentId];

            if (currentStudent) {
                const allDocs = await Student.find({ roll: currentStudent.roll });
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
                const allDocs = await Student.find({ roll: currentStudent.roll });
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
