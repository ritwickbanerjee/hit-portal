import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';
import Question from '@/models/Question';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import Config from '@/models/Config';
import FacultyConfig from '@/models/FacultyConfig';
import Submission from '@/models/Submission';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();
        const { id } = await params;

        // SECURE: Read from headers set by middleware
        const studentId = req.headers.get('x-user-id');

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get the assignment
        const assignment = await Assignment.findById(id);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // 2. Get student details
        // 2. Get student details (Find KEY student)
        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2b. Find ALL student IDs for this person (same roll number)
        // This is crucial for students enrolled in multiple courses with different IDs
        const allStudentDocs = await Student.find({ roll: student.roll });
        const allStudentIds = allStudentDocs.map(s => s._id.toString());

        // 3. Get global config
        const config = await Config.findOne() || { attendanceRequirement: 70, attendanceRules: {} };

        // 4. Check deadline
        const now = new Date();
        const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
        const isPastDeadline = deadline && deadline < now;

        // 5. Calculate student's attendance for the FACULTY who created the assignment
        // Using `allStudentIds` check
        const courseCode = assignment.targetCourse || assignment.course_code;
        const facultyName = assignment.facultyName;
        let attendancePercent = 100;
        let totalClasses = 0;
        let attendedClasses = 0;

        if (courseCode && facultyName) {
            const allAttendance = await Attendance.find({});
            const normalizedCourseCode = courseCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

            const facultyRecords = allAttendance.filter((r: any) => {
                const recordCourse = (r.course_code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                const recordTeacher = r.teacherName || "";
                return recordCourse === normalizedCourseCode &&
                    recordTeacher.toLowerCase().trim() === facultyName.toLowerCase().trim();
            });

            const participatedRecords = facultyRecords.filter((r: any) =>
                (r.presentStudentIds && r.presentStudentIds.some((pid: any) => allStudentIds.includes(pid.toString()))) ||
                (r.absentStudentIds && r.absentStudentIds.some((pid: any) => allStudentIds.includes(pid.toString())))
            );

            totalClasses = participatedRecords.length;

            if (totalClasses > 0) {
                attendedClasses = participatedRecords.filter((r: any) =>
                    r.presentStudentIds && r.presentStudentIds.some((pid: any) => allStudentIds.includes(pid.toString()))
                ).length;

                // Add Adjustments
                // Sum adjustments across ALL student profiles for this user
                const totalAttendedAdj = allStudentDocs.reduce((sum, s) => sum + (s.attended_adjustment || 0), 0);
                const totalClassesAdj = allStudentDocs.reduce((sum, s) => sum + (s.total_classes_adjustment || 0), 0);

                attendedClasses += totalAttendedAdj;
                totalClasses += totalClassesAdj;

                attendancePercent = (attendedClasses / totalClasses) * 100;
            } else {
                // Even if no calculated classes, adjustments might exist
                const totalAttendedAdj = allStudentDocs.reduce((sum, s) => sum + (s.attended_adjustment || 0), 0);
                const totalClassesAdj = allStudentDocs.reduce((sum, s) => sum + (s.total_classes_adjustment || 0), 0);

                if (totalClassesAdj > 0) {
                    attendedClasses = totalAttendedAdj;
                    totalClasses = totalClassesAdj;
                    attendancePercent = (attendedClasses / totalClasses) * 100;
                }
            }
        }

        // 6. Determine required attendance
        const configKey = `${student.department}_${student.year}_${courseCode}`;
        let requiredAttendance = config.attendanceRules?.[configKey] || config.attendanceRequirement || 70;

        if (assignment.type === 'batch_attendance' && assignment.rules && assignment.rules.length > 0) {
            const sortedRules = [...assignment.rules].sort((a: any, b: any) => b.min - a.min);
            const lowestRule = sortedRules[sortedRules.length - 1];
            requiredAttendance = lowestRule.min;
        }

        // Personalized and batch_attendance are always accessible
        const isSpecialType = assignment.type === 'personalized' || assignment.type === 'batch_attendance';
        const canAccess = isSpecialType || attendancePercent >= requiredAttendance;

        // 7. Get student's assigned questions
        console.log(`[Detailed Debug] Fetching questions for Assignment: ${id}`);
        console.log(`[Detailed Debug] Student IDs: ${JSON.stringify(allStudentIds)}`);
        console.log(`[Detailed Debug] CanAccess: ${canAccess}, IsPastDeadline: ${isPastDeadline}`);

        const studentAssignment = await StudentAssignment.findOne({
            studentId: { $in: allStudentIds },
            assignmentId: id
        });

        console.log(`[Detailed Debug] StudentAssignment found: ${!!studentAssignment}`);

        let questions: any[] = [];
        // DEBUG: Bypassing canAccess check to verify data loading
        if (true || (canAccess && !isPastDeadline)) { // FORCE TRUE FOR DEBUGGING
            if (studentAssignment && studentAssignment.questionIds) {
                console.log(`[Detailed Debug] Fetching from studentAssignment.questionIds: ${studentAssignment.questionIds.length}`);
                questions = await Question.find({
                    _id: { $in: studentAssignment.questionIds }
                });
            } else if (assignment.questions && assignment.questions.length > 0) {
                console.log(`[Detailed Debug] Fetching from assignment.questions: ${assignment.questions.length}`);
                questions = await Question.find({
                    _id: { $in: assignment.questions }
                });
            } else {
                console.log(`[Detailed Debug] No questions found in assignment or studentAssignment`);
            }
        } else {
            console.log(`[Detailed Debug] Skipping question fetch due to access/deadline restrictions`);
        }

        console.log(`[Detailed Debug] Final Questions Count: ${questions.length}`);

        // 8. Get faculty's script URL for submission (matching legacy logic)
        let scriptUrl = null;
        if (facultyName) {
            // Helper function to normalize text for comparison
            const normalizeText = (text: string) => {
                if (!text) return "";
                return text.toString().trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            };

            // First attempt: Exact match (facultyName + course)
            const allFacultyConfigs = await FacultyConfig.find({ facultyName });
            const normalizedCourse = normalizeText(courseCode);

            const exactConfig = allFacultyConfigs.find((c: any) =>
                c.facultyName === facultyName &&
                normalizeText(c.course) === normalizedCourse
            );

            if (exactConfig && exactConfig.scriptUrl) {
                scriptUrl = exactConfig.scriptUrl;
                console.log(`[scriptUrl] Exact match found for ${facultyName} + ${courseCode}`);
            } else {
                // Second attempt: Loose match (just facultyName)
                const looseConfig = allFacultyConfigs.find((c: any) => c.scriptUrl);
                if (looseConfig && looseConfig.scriptUrl) {
                    scriptUrl = looseConfig.scriptUrl;
                    console.log(`[scriptUrl] Loose match found for ${facultyName}`);
                }
            }
        }

        // Third attempt: Fallback to assignment's own scriptUrl field
        if (!scriptUrl && assignment.scriptUrl) {
            scriptUrl = assignment.scriptUrl;
            console.log(`[scriptUrl] Using assignment's scriptUrl`);
        }

        if (!scriptUrl) {
            console.warn(`[scriptUrl] No scriptUrl found for assignment ${id}, faculty: ${facultyName}, course: ${courseCode}`);
        }

        // 9. Check if already submitted
        const existingSubmission = await Submission.findOne({
            assignment: id,
            student: studentId
        });

        return NextResponse.json({
            assignment: {
                _id: assignment._id,
                title: assignment.title,
                description: assignment.description,
                type: assignment.type,
                deadline: assignment.deadline,
                startTime: assignment.startTime,
                targetCourse: assignment.targetCourse || assignment.course_code,
                facultyName: assignment.facultyName,
            },
            questions: questions.map(q => ({
                _id: q._id,
                id: q.id,
                text: q.text,
                latex: q.latex,
                type: q.type,
                topic: q.topic,
                subtopic: q.subtopic,
            })),
            attendance: {
                percent: Math.round(attendancePercent * 10) / 10,
                totalClasses,
                attendedClasses,
                facultyName: facultyName || 'Unknown',
            },
            access: {
                canAccess,
                requiredAttendance,
                isPastDeadline,
            },
            submission: existingSubmission ? {
                status: 'submitted',
                submittedAt: existingSubmission.submittedAt,
                driveLink: existingSubmission.driveLink,
            } : (studentAssignment ? {
                status: studentAssignment.status,
                submittedAt: studentAssignment.submittedAt,
            } : null),
            scriptUrl,
            student: {
                _id: student._id,
                roll: student.roll,
                name: student.name,
                department: student.department,
                year: student.year,
                course_code: student.course_code,
            }
        });

    } catch (error: any) {
        console.error('Fetch Student Assignment Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
