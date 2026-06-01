import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';
import Submission from '@/models/Submission';
import Student from '@/models/Student';
import Question from '@/models/Question';
import Config from '@/models/Config';
import Attendance from '@/models/Attendance';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const course = searchParams.get('course');
        const faculty = searchParams.get('faculty'); // optional faculty filter

        if (!course) {
            return NextResponse.json({ error: 'Course is required' }, { status: 400 });
        }

        // Auth
        let token: string | null = null;
        const cookieStore = req.headers.get('cookie');
        if (cookieStore) {
            const cookies = cookieStore.split(';').reduce((acc: any, c) => {
                const [k, v] = c.trim().split('=');
                acc[k] = v;
                return acc;
            }, {});
            token = cookies['auth_token'];
        }
        if (!token) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) token = authHeader.split(' ')[1];
        }
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let studentId: string;
        try {
            const { payload } = await jwtVerify(token, key);
            studentId = payload.userId as string;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get student and all their IDs (same roll)
        const student = await Student.findById(studentId);
        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        const allStudentDocs = await Student.find({ roll: student.roll, loginDisabled: { $ne: true } });
        const allStudentIds = allStudentDocs.map(s => s._id);

        // Build query: assignments that specifically target THIS course
        const assignmentQuery: any = {
            $or: [
                { targetCourse: course },
                { course_code: course }
            ]
        };
        // If faculty filter provided, narrow down to only that faculty
        if (faculty) {
            assignmentQuery.facultyName = faculty;
        }

        let assignments = await Assignment.find(assignmentQuery).sort({ createdAt: 1 });

        // IMPORTANT: Only include assignments that the student was actually part of.
        // For 'personalized' types: only if they have a StudentAssignment record.
        // For general types (manual, randomized, batch_attendance): 
        //   must match student's current department + year.
        const studentDept = student.department;
        const studentYear = student.year;

        // Pre-fetch StudentAssignment records for filtering
        const allStudentAssignments = await StudentAssignment.find({
            studentId: { $in: allStudentIds },
            assignmentId: { $in: assignments.map(a => a._id) }
        });
        const saIdSet = new Set(allStudentAssignments.map(sa => sa.assignmentId.toString()));

        assignments = assignments.filter(a => {
            // Personalized: must have a StudentAssignment record
            if (a.type === 'personalized') {
                return saIdSet.has(a._id.toString());
            }
            // General types: must match dept+year
            const matchesDept = a.targetDepartments?.includes(studentDept);
            const matchesYear = a.targetYear === studentYear;
            return matchesDept && matchesYear;
        });

        // Collect unique faculty names for the response (so front-end can prompt)
        const facultyNamesSet = new Set(assignments.map(a => a.facultyName).filter(Boolean));
        
        // Also include all allocated faculties for this course, even if they haven't posted yet
        const config = await Config.findOne({ key: 'data' });
        const teacherAssignments = config?.teacherAssignments || new Map();
        const courseKey = `${studentDept}_${studentYear}_${course}`;
        const allocatedFaculties = teacherAssignments.get(courseKey) || [];
        
        allocatedFaculties.forEach((f: any) => {
            if (f.name) facultyNamesSet.add(f.name);
        });
        
        let facultyNames = Array.from(facultyNamesSet);

        // Fetch all submissions for this student across these assignments
        const submissions = await Submission.find({
            student: { $in: allStudentIds },
            assignment: { $in: assignments.map(a => a._id) }
        });
        const submissionMap = new Map(submissions.map(s => [s.assignment.toString(), s]));

        // Build saMap from already-fetched records
        const saMap = new Map(allStudentAssignments.map(sa => [sa.assignmentId.toString(), sa]));

        // Gather all question IDs needed
        const allQuestionIds: any[] = [];
        assignments.forEach(a => {
            const sa = saMap.get(a._id.toString());
            if (sa && sa.questionIds?.length > 0) {
                allQuestionIds.push(...sa.questionIds);
            } else if (a.questions?.length > 0) {
                allQuestionIds.push(...a.questions);
            }
        });

        const questions = await Question.find({ _id: { $in: allQuestionIds } });
        const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

        // Build assignment data
        const assignmentData = assignments.map(a => {
            const sub = submissionMap.get(a._id.toString());
            const sa = saMap.get(a._id.toString());

            let assignedQuestions: any[] = [];
            if (sa && sa.questionIds?.length > 0) {
                assignedQuestions = sa.questionIds
                    .map((id: any) => questionMap.get(id.toString()))
                    .filter(Boolean)
                    .map((q: any) => ({ text: q.text }));
            } else if (a.questions?.length > 0) {
                assignedQuestions = a.questions
                    .map((id: any) => questionMap.get(id.toString()))
                    .filter(Boolean)
                    .map((q: any) => ({ text: q.text }));
            }

            return {
                _id: a._id,
                title: a.title,
                type: a.type,
                createdAt: a.createdAt,
                deadline: a.deadline,
                facultyName: a.facultyName,
                submitted: !!sub,
                submittedAt: sub?.submittedAt || null,
                questions: assignedQuestions,
            };
        });

        // Fetch attendance for the student + course
        let attendancePercent = 0;
        {
            const normalizedCourse = course.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            let allAttendance = (await Attendance.find({})).filter((r: any) => {
                const recordCourse = (r.course_code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                return recordCourse === normalizedCourse;
            });

            if (faculty) {
                const normalizedFaculty = faculty.toLowerCase().trim();
                allAttendance = allAttendance.filter((r: any) => 
                    (r.teacherName || "").toLowerCase().trim() === normalizedFaculty
                );
            }
            
            const participatedRecords = allAttendance.filter((r: any) =>
                (r.presentStudentIds && r.presentStudentIds.some((pid: any) =>
                    allStudentIds.map(id => id.toString()).includes(pid.toString())
                )) ||
                (r.absentStudentIds && r.absentStudentIds.some((pid: any) =>
                    allStudentIds.map(id => id.toString()).includes(pid.toString())
                ))
            );

            let totalClasses = participatedRecords.length;
            let attendedClasses = 0;

            if (totalClasses > 0) {
                attendedClasses = participatedRecords.filter((r: any) =>
                    r.presentStudentIds && r.presentStudentIds.some((pid: any) =>
                        allStudentIds.map(id => id.toString()).includes(pid.toString())
                    )
                ).length;
            }

            const totalAttendedAdj = allStudentDocs.reduce((sum, s) => sum + (s.attended_adjustment || 0), 0);
            const totalClassesAdj = allStudentDocs.reduce((sum, s) => sum + (s.total_classes_adjustment || 0), 0);

            attendedClasses += totalAttendedAdj;
            totalClasses += totalClassesAdj;

            if (totalClasses > 0) {
                attendancePercent = Math.round((attendedClasses / totalClasses) * 1000) / 10;
            } else if (totalClassesAdj > 0) {
                totalClasses = totalClassesAdj;
                attendancePercent = Math.round((totalAttendedAdj / totalClasses) * 1000) / 10;
            }
        }

        return NextResponse.json({
            student: {
                name: student.name,
                roll: student.roll,
                year: student.year,
                department: student.department,
                course_code: course,
                attendancePercent: attendancePercent // added
            },
            facultyNames,
            assignments: assignmentData,
        });

    } catch (error: any) {
        console.error('Top Sheet API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
