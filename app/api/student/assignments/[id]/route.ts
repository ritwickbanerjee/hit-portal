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
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function selectQuestionsByWeight(assignment: any, countToSelect: number) {
    let selectedIds: any[] = [];
    
    if (assignment.topicWeights && assignment.topicWeights.length > 0) {
        const poolQuestions = await Question.find({ _id: { $in: assignment.questionPool } });
        
        const topicMap: { [topic: string]: any[] } = {};
        assignment.topicWeights.forEach((tw: any) => {
            topicMap[tw.topic] = [];
        });
        
        poolQuestions.forEach((q: any) => {
            if (topicMap[q.topic] !== undefined) {
                topicMap[q.topic].push(q._id.toString());
            }
        });
        
        let remainingCount = countToSelect;
        const guaranteedIds: string[] = [];
        const remainingPools: { [topic: string]: string[] } = {};
        
        assignment.topicWeights.forEach((tw: any) => {
            let qs = [...topicMap[tw.topic]].sort(() => 0.5 - Math.random());
            if (qs.length > 0 && remainingCount > 0) {
                guaranteedIds.push(qs[0]);
                qs = qs.slice(1);
                remainingCount--;
            }
            remainingPools[tw.topic] = qs;
        });
        
        const additionalIds: string[] = [];
        if (remainingCount > 0) {
            const totalWeight = assignment.topicWeights.reduce((sum: number, tw: any) => sum + tw.weight, 0);
            let allocations: { topic: string, count: number }[] = [];
            let allocatedSum = 0;
            
            assignment.topicWeights.forEach((tw: any) => {
                const ratio = totalWeight > 0 ? (tw.weight / totalWeight) : 0;
                const count = Math.floor(ratio * remainingCount);
                allocations.push({ topic: tw.topic, count });
                allocatedSum += count;
            });
            
            let remainder = remainingCount - allocatedSum;
            allocations.sort((a, b) => {
                const twA = assignment.topicWeights.find((tw: any) => tw.topic === a.topic)?.weight || 0;
                const twB = assignment.topicWeights.find((tw: any) => tw.topic === b.topic)?.weight || 0;
                return twB - twA;
            });
            
            for (let i = 0; i < remainder; i++) {
                allocations[i % allocations.length].count++;
            }
            
            allocations.forEach(a => {
                let qs = remainingPools[a.topic] || [];
                const needed = a.count;
                const grabbed = qs.slice(0, needed);
                additionalIds.push(...grabbed);
                remainingPools[a.topic] = qs.slice(needed);
            });
        }
        
        selectedIds = [...guaranteedIds, ...additionalIds];
        if (selectedIds.length < countToSelect) {
            let allUnused: string[] = [];
            Object.values(remainingPools).forEach(qs => allUnused.push(...qs));
            allUnused = allUnused.sort(() => 0.5 - Math.random());
            const shortfall = countToSelect - selectedIds.length;
            selectedIds.push(...allUnused.slice(0, shortfall));
        }
        
        selectedIds = selectedIds.sort(() => 0.5 - Math.random());
    } else {
        const shuffled = [...assignment.questionPool].sort(() => 0.5 - Math.random());
        selectedIds = shuffled.slice(0, countToSelect);
    }
    return selectedIds;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();
        const { id } = await params;

        // 0. Manual Auth Verification (Middleware Fallback)
        let token = null;
        const cookieStore = req.headers.get('cookie');
        if (cookieStore) {
            const cookies = cookieStore.split(';').reduce((acc: any, cookie) => {
                const [k, v] = cookie.trim().split('=');
                acc[k] = v;
                return acc;
            }, {});
            token = cookies['auth_token'];
        }

        if (!token) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
        }

        let studentId;
        try {
            const { payload } = await jwtVerify(token, key);
            studentId = payload.userId as string;
        } catch (err) {
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get the assignment
        const assignment = await Assignment.findById(id);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // 2. Get student details
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

        let isZeroCountBatch = false;

        if (assignment.type === 'batch_attendance' && assignment.rules && assignment.rules.length > 0) {
            const sortedRules = [...assignment.rules].sort((a: any, b: any) => b.min - a.min);
            const lowestRule = sortedRules[sortedRules.length - 1];
            requiredAttendance = lowestRule.min;

            // Check if current attendance maps to a rule with count 0
            // Use sorted rules with exclusive upper bound for consistent boundary handling
            const matchingRule = sortedRules.find((r: any) => {
                const minMatch = attendancePercent >= (r.min || 0);
                const maxVal = r.max || 100;
                const maxMatch = maxVal >= 100 ? attendancePercent <= maxVal : attendancePercent < maxVal;
                return minMatch && maxMatch;
            });
            if (matchingRule && matchingRule.count === 0) {
                isZeroCountBatch = true;
            }
        }

        // Personalized and batch_attendance are always accessible EXCEPT if batch_attendance rule says count=0
        const isSpecialType = (assignment.type === 'personalized' || assignment.type === 'batch_attendance') && !isZeroCountBatch;
        const canAccess = isSpecialType || attendancePercent >= requiredAttendance;

        // 7. Get student's assigned questions
        let studentAssignment = await StudentAssignment.findOne({
            studentId: { $in: allStudentIds },
            assignmentId: id
        });

        // 0. Manual Auth Verification (Middleware Fallback)

        // 7b. Check if already submitted (needed for dynamic recalculation)
        const existingSubmission = await Submission.findOne({
            assignment: id,
            student: { $in: allStudentIds }
        });

        // 7c. Lazy Generation and Dynamic Recalculation
        if (canAccess && !isPastDeadline && ['randomized', 'batch_attendance'].includes(assignment.type) && assignment.questionPool?.length > 0) {
            let countToSelect = 0;

            if (assignment.type === 'randomized') {
                countToSelect = assignment.questionCount || 0;
            } else if (assignment.type === 'batch_attendance' && assignment.rules) {
                // Use sorted rules with exclusive upper bound for consistent boundary handling
                const sortedLazyRules = [...assignment.rules].sort((a: any, b: any) => b.min - a.min);
                const matchingRule = sortedLazyRules.find((r: any) => {
                    const minMatch = attendancePercent >= (r.min || 0);
                    const maxVal = r.max || 100;
                    const maxMatch = maxVal >= 100 ? attendancePercent <= maxVal : attendancePercent < maxVal;
                    return minMatch && maxMatch;
                });
                if (matchingRule) countToSelect = matchingRule.count || 0;
            }

            if (!studentAssignment && countToSelect > 0) {
                // Lazy Generation
                const selectedIds = await selectQuestionsByWeight(assignment, countToSelect);

                try {
                    studentAssignment = await StudentAssignment.create({
                        assignmentId: assignment._id,
                        studentId: student._id,
                        studentRoll: student.roll,
                        questionIds: selectedIds,
                        status: 'pending',
                        startedAt: new Date()
                    });
                } catch (err) {
                    console.error('Lazy generation failed:', err);
                    // Continue without crashing, questions will remain empty
                }
            } else if (studentAssignment && !existingSubmission && assignment.type === 'batch_attendance') {
                // Dynamic Recalculation: update questions if attendance rule dictates a different count
                const currentLength = studentAssignment.questionIds ? studentAssignment.questionIds.length : 0;
                if (currentLength !== countToSelect) {
                    const newSelectedIds = await selectQuestionsByWeight(assignment, countToSelect);
                    
                    try {
                        studentAssignment.questionIds = newSelectedIds;
                        await studentAssignment.save();
                    } catch (err) {
                        console.error('Dynamic recalculation failed:', err);
                    }
                }
            }
        }

        let questions: any[] = [];
        if (canAccess && !isPastDeadline) {
            if (studentAssignment && studentAssignment.questionIds) {
                questions = await Question.find({
                    _id: { $in: studentAssignment.questionIds }
                });
            } else if (assignment.questions && assignment.questions.length > 0) {
                questions = await Question.find({
                    _id: { $in: assignment.questions }
                });
            }
        }

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
            } else {
                // Second attempt: Loose match (just facultyName)
                const looseConfig = allFacultyConfigs.find((c: any) => c.scriptUrl);
                if (looseConfig && looseConfig.scriptUrl) {
                    scriptUrl = looseConfig.scriptUrl;
                }
            }
        }

        // Third attempt: Fallback to assignment's own scriptUrl field
        if (!scriptUrl && assignment.scriptUrl) {
            scriptUrl = assignment.scriptUrl;
        }

        // 9. Check if already submitted (Fetched earlier)
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
                image: q.image,
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
                isZeroCountBatch,
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
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (error: any) {
        console.error('Fetch Student Assignment Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
