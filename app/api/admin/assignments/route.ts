import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Assignment from '@/models/Assignment';
import Question from '@/models/Question';
import Student from '@/models/Student';
import StudentAssignment from '@/models/StudentAssignment';
import Notification from '@/models/Notification';
import Attendance from '@/models/Attendance';
import Submission from '@/models/Submission';
import User from '@/models/User';

const GLOBAL_ADMIN_KEY = 'globaladmin_25';

export async function GET(req: Request) {
    await connectDB();
    const email = req.headers.get('X-User-Email');
    const adminKey = req.headers.get('X-Global-Admin-Key');

    // Global Admin Setup: Seeing ALL assignments
    if (adminKey === GLOBAL_ADMIN_KEY) {
        try {
            const assignments = await Assignment.find({}).sort({ createdAt: -1 });
            return NextResponse.json(assignments);
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Regular Faculty: Seeing ONLY their own assignments (Legacy support via facultyName)
    try {
        const user = await User.findOne({ email });
        const name = user?.name;

        const query: any = { createdBy: email };
        if (name) {
            // If createdBy is missing, fallback to facultyName
            const orQuery = [
                { createdBy: email },
                { createdBy: { $exists: false }, facultyName: name }
            ];
            // Actually, simplest is just matching either.
            // But let's be strict: if createdBy exists, it must match.
            // Access Policy: Owner is (createdBy == email) OR (facultyName == name AND createdBy is null)

            // Simplified query:
            // $or: [{ createdBy: email }, { facultyName: name }]
            query['$or'] = [{ createdBy: email }, { facultyName: name }];
            delete query.createdBy; // Remove strict single field check
        }

        const assignments = await Assignment.find(query).sort({ createdAt: -1 });
        return NextResponse.json(assignments);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const userEmail = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!userEmail && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const creator = (adminKey === GLOBAL_ADMIN_KEY && !userEmail) ? 'global_admin' : userEmail;

        const { type } = body;

        let assignment;
        let targetStudents: any[] = [];
        let studentAssignments: any[] = [];
        let notifications: any[] = [];

        // 1. Fetch Students based on filters (Common for Manual, Randomized, Batch)
        if (['manual', 'randomized', 'batch_attendance'].includes(type)) {
            const query: any = {};
            if (body.targetDepartments && body.targetDepartments.length > 0) {
                query.department = { $in: body.targetDepartments };
            }
            if (body.targetYear && body.targetYear !== 'all') {
                query.year = body.targetYear;
            }
            if (body.targetCourse) {
                query.course_code = body.targetCourse;
            }
            targetStudents = await Student.find(query);
        } else if (type === 'personalized') {
            targetStudents = await Student.find({ _id: { $in: body.targetStudentIds } });
        }

        if (targetStudents.length === 0) {
            return NextResponse.json({ error: 'No students match the criteria' }, { status: 400 });
        }

        // 2. Create Assignment Document
        assignment = (await Assignment.create({ ...body, createdBy: creator })) as any;

        // 3. Handle Specific Logic
        if (type === 'manual') {
            // Manual: Just notify students
        }
        else if (type === 'randomized') {
            const pool = body.questionPool; // Array of Question IDs
            const count = body.questionCount;

            for (const student of targetStudents) {
                // Shuffle and pick
                const shuffled = [...pool].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                studentAssignments.push({
                    studentId: student._id,
                    studentRoll: student.roll,
                    assignmentId: assignment._id,
                    questionIds: selected,
                    status: 'pending'
                });
            }
        }
        else if (type === 'batch_attendance') {
            // Fetch Attendance Records
            const facultyCourseCode = body.targetCourse.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            const allAttendance = await Attendance.find({});

            const courseRecords = allAttendance.filter((r: any) =>
                (r.course_code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === facultyCourseCode
            );

            // Filter questions by pool if provided
            let allowedQuestions = await Question.find({});
            if (body.questionPool && Array.isArray(body.questionPool)) {
                allowedQuestions = allowedQuestions.filter((q: any) => body.questionPool.includes(q._id.toString()));
            }

            // Sort rules by min descending to handle overlaps (e.g. 70 in 50-70 vs 70-100)
            const sortedRules = (body.rules || []).sort((a: any, b: any) => b.min - a.min);

            for (const student of targetStudents) {
                // Calculate Attendance %
                const participatedRecords = courseRecords.filter((r: any) =>
                    (r.presentStudentIds && r.presentStudentIds.includes(student._id)) ||
                    (r.absentStudentIds && r.absentStudentIds.includes(student._id))
                );

                const totalClasses = participatedRecords.length;
                let percent = 100;

                if (totalClasses > 0) {
                    const presentCount = participatedRecords.filter((r: any) => r.presentStudentIds && r.presentStudentIds.includes(student._id)).length;
                    const adj = student.attended_adjustment || 0;
                    percent = ((presentCount + adj) / totalClasses) * 100;
                }

                // Match Rule
                const rule = sortedRules.find((r: any) => percent >= r.min && percent <= r.max);

                if (rule) {
                    const totalQ = rule.count;
                    let qIdsSet = new Set<string>();

                    // Topic Weights
                    if (body.topicWeights && body.topicWeights.length > 0) {
                        body.topicWeights.forEach((tw: any) => {
                            const n = Math.round(totalQ * (tw.weight / 100));
                            const pool = allowedQuestions.filter((q: any) => q.topic === tw.topic);
                            const picked = [...pool].sort(() => 0.5 - Math.random()).slice(0, n);
                            picked.forEach((q: any) => qIdsSet.add(q._id.toString()));
                        });
                    }

                    // Fill remaining from allowed questions
                    if (qIdsSet.size < totalQ) {
                        const rest = allowedQuestions.filter((q: any) => !qIdsSet.has(q._id.toString()));
                        const needed = totalQ - qIdsSet.size;
                        const fill = [...rest].sort(() => 0.5 - Math.random()).slice(0, needed);
                        fill.forEach((q: any) => qIdsSet.add(q._id.toString()));
                    }

                    const finalQIds = Array.from(qIdsSet).slice(0, totalQ);

                    if (finalQIds.length > 0) {
                        studentAssignments.push({
                            studentId: student._id,
                            studentRoll: student.roll,
                            assignmentId: assignment._id,
                            questionIds: finalQIds,
                            status: 'pending'
                        });
                    }
                }
            }
        }
        else if (type === 'personalized') {
            const pool = body.questionPool; // Array of Question IDs
            const count = body.questionCount;

            for (const student of targetStudents) {
                const shuffled = [...pool].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                if (selected.length > 0) {
                    studentAssignments.push({
                        studentId: student._id,
                        studentRoll: student.roll,
                        assignmentId: assignment._id,
                        questionIds: selected,
                        status: 'pending'
                    });
                }
            }
        }

        // 4. Batch Insert Student Assignments
        if (studentAssignments.length > 0) {
            await StudentAssignment.insertMany(studentAssignments);
        }

        // 5. Create Notifications
        let notifStudents = targetStudents;
        if (type === 'personalized' || type === 'batch_attendance') {
            // Only notify students who actually got an assignment
            const assignedIds = new Set(studentAssignments.map(sa => sa.studentId.toString()));
            notifStudents = targetStudents.filter(s => assignedIds.has(s._id.toString()));
        }

        notifications = notifStudents.map(s => ({
            studentId: s._id,
            title: body.title,
            message: `New ${type.replace('_', ' ')} assignment available.`,
            link: '/student/assignments',
            assignmentId: assignment._id,
            isRead: false
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        return NextResponse.json(assignment);

    } catch (error: any) {
        console.error("Assignment Creation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const email = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find and Verify Ownership
        let assignment;
        if (adminKey === GLOBAL_ADMIN_KEY) {
            assignment = await Assignment.findById(id);
        } else {
            // Strict or Legacy check
            const user = await User.findOne({ email });
            const name = user?.name;

            const query: any = { _id: id };
            if (name) {
                query['$or'] = [{ createdBy: email }, { facultyName: name }];
            } else {
                query.createdBy = email;
            }
            assignment = await Assignment.findOne(query);
        }

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found or unauthorized' }, { status: 404 });
        }

        // 2. Delete
        await Assignment.findByIdAndDelete(id);

        // 3. Delete Related (Student Assignments, Notifications, Submissions)
        await StudentAssignment.deleteMany({ assignmentId: id });
        await Notification.deleteMany({ assignmentId: id });
        await Submission.deleteMany({ assignment: id });

        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { id, deadline, startTime } = body;
        const email = req.headers.get('X-User-Email');
        const adminKey = req.headers.get('X-Global-Admin-Key');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        if (!email && adminKey !== GLOBAL_ADMIN_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updateData: any = {};
        if (deadline) updateData.deadline = new Date(deadline);
        if (startTime) updateData.startTime = new Date(startTime);

        let assignment;
        if (adminKey === GLOBAL_ADMIN_KEY) {
            assignment = await Assignment.findByIdAndUpdate(id, updateData, { new: true });
        } else {
            const user = await User.findOne({ email });
            const name = user?.name;

            const query: any = { _id: id };
            if (name) {
                query['$or'] = [{ createdBy: email }, { facultyName: name }];
            } else {
                query.createdBy = email;
            }
            assignment = await Assignment.findOneAndUpdate(query, updateData, { new: true });
        }

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json(assignment);
    } catch (error: any) {
        console.error('Assignment Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

