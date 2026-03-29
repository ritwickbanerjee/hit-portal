import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import Student from '@/models/Student';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id: testId } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        const isGlobalAdmin = request.headers.get('X-Global-Admin-Key') === 'globaladmin_25';

        if (!userEmail && !isGlobalAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const test = isGlobalAdmin
            ? await OnlineTest.findById(testId)
            : await OnlineTest.findOne({ 
                _id: testId, 
                createdBy: { $regex: new RegExp(`^${userEmail}$`, 'i') } 
            });

        if (!test) {
            console.error(`[ResultsAPI] Test not found: ${testId} for user: ${userEmail}`);
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Get students who SHOULD have taken this test (Audience)
        const depts = test.deployment?.department || [];
        const year = test.deployment?.year;
        const course = test.deployment?.course;

        const dbStudents = await Student.find({
            department: { $in: depts },
            year: year,
            course_code: course,
            loginDisabled: { $ne: true }
        }).select('roll name email department year course_code').lean() as any[];

        const studentMap = new Map<string, any>();
        dbStudents.forEach(s => {
            const phone = s.roll;
            if (phone) {
                studentMap.set(phone, {
                    name: s.name || 'Unknown',
                    roll: s.roll,
                    email: s.email || 'N/A',
                    phone: phone,
                    batchName: `${s.department}_${s.year}_${s.course_code}`
                });
            }
        });

        const attempts = await StudentTestAttempt.find({ testId });

        // --- Lazy auto-cleanup: complete expired in_progress attempts ---
        const now = new Date();
        const durationMs = (test.deployment?.durationMinutes || 60) * 60 * 1000;
        const endTimeStr = test.deployment?.endTime;
        const endTime = endTimeStr ? new Date(endTimeStr) : null;

        for (const attempt of attempts) {
            if (attempt.status !== 'in_progress') continue;

            const startedAt = new Date(attempt.startedAt).getTime();
            const elapsed = now.getTime() - startedAt;
            const isExpiredByDuration = elapsed > durationMs;
            const isExpiredByEndTime = endTime ? now > endTime : false;

            if (isExpiredByDuration || isExpiredByEndTime) {
                const sourceQuestions = (attempt.questions && attempt.questions.length > 0) ? attempt.questions : test.questions;
                let totalScore = 0;
                const gradedAnswers: any[] = [];
                const qMap = new Map<string, any>();
                for (const q of sourceQuestions) {
                    qMap.set(q.id, q);
                    if (q.type === 'comprehension' && q.subQuestions) {
                        for (const sq of q.subQuestions) qMap.set(sq.id, sq);
                    }
                }

                for (const ans of (attempt.answers || [])) {
                    const question = qMap.get(ans.questionId);
                    if (!question) continue;

                    let isCorrect = false;
                    let marksAwarded = 0;

                    if (ans.answer === null || ans.answer === undefined || ans.answer === '' || (Array.isArray(ans.answer) && ans.answer.length === 0)) {
                        // unanswered
                    } else if (question.type === 'mcq') {
                        isCorrect = question.correctIndices?.[0] === ans.answer;
                        marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                    } else if (question.type === 'msq') {
                        if (question.correctIndices && Array.isArray(ans.answer)) {
                            const correct = new Set(question.correctIndices as number[]);
                            const selected = new Set(ans.answer as number[]);
                            isCorrect = correct.size === selected.size && [...correct].every((i: number) => selected.has(i));
                        }
                        marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                    } else if (question.type === 'fillblank') {
                        if (question.isNumberRange) {
                            const numAnswer = parseFloat(ans.answer);
                            isCorrect = !isNaN(numAnswer) && numAnswer >= (question.numberRangeMin ?? 0) && numAnswer <= (question.numberRangeMax ?? 0);
                        } else {
                            const sa = question.caseSensitive ? String(ans.answer).trim() : String(ans.answer).trim().toLowerCase();
                            const ca = question.caseSensitive ? String(question.fillBlankAnswer).trim() : String(question.fillBlankAnswer).trim().toLowerCase();
                            isCorrect = sa === ca;
                        }
                        marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                    }
                    totalScore += marksAwarded;
                    gradedAnswers.push({ questionId: ans.questionId, answer: ans.answer, isCorrect, marksAwarded });
                }

                totalScore = Math.max(0, totalScore);
                let servedTotalMarks = 0;
                for (const q of sourceQuestions) {
                    if (q.type === 'comprehension' && q.subQuestions) {
                        for (const sq of q.subQuestions) servedTotalMarks += sq.marks || 1;
                    } else servedTotalMarks += q.marks || 1;
                }
                const tm = servedTotalMarks || test.totalMarks || 1;

                attempt.answers = gradedAnswers;
                attempt.score = totalScore;
                attempt.percentage = Math.round((totalScore / tm) * 100);
                attempt.status = 'completed';
                attempt.submittedAt = now;
                attempt.timeSpent = attempt.timeSpent || elapsed;
                attempt.terminationReason = 'server_auto_expired';
                await attempt.save();
            }
        }

        const completed: any[] = [];
        const inProgress: any[] = [];
        const notStarted: any[] = [];
        const handledPhones = new Set<string>();

        // 1. Process all attempts
        attempts.forEach(attempt => {
            const key = attempt.studentPhone || attempt.studentEmail;
            if (!key) return;

            const studentData = studentMap.get(key);
            const resultData = {
                name: attempt.studentName || studentData?.name || 'Unknown',
                roll: studentData?.roll || attempt.studentPhone || key,
                email: attempt.studentEmail || studentData?.email || 'N/A',
                phone: key,
                batchName: attempt.batchName || studentData?.batchName || 'N/A',
                status: attempt.status,
                score: attempt.score,
                percentage: attempt.percentage,
                timeSpent: attempt.timeSpent,
                submittedAt: attempt.submittedAt,
                warningCount: attempt.warningCount || 0,
                windowSwitchCount: attempt.windowSwitchCount || 0,
                screenshotCount: attempt.screenshotCount || 0,
                violations: attempt.violations || [],
                terminationReason: attempt.terminationReason
            };

            if (attempt.status === 'completed') completed.push(resultData);
            else inProgress.push(resultData);
            handledPhones.add(key);
        });

        // 2. Add students who haven't started
        studentMap.forEach((student, phone) => {
            if (!handledPhones.has(phone)) {
                notStarted.push({
                    name: student.name,
                    roll: student.roll,
                    email: student.email,
                    phone: phone,
                    batchName: student.batchName,
                    status: 'not_started',
                    score: 0,
                    percentage: 0
                });
            }
        });

        completed.sort((a, b) => b.score - a.score);

        // Analytics
        const totalStudents = studentMap.size;
        const totalParticipants = completed.length + inProgress.length;
        const participationRate = totalStudents > 0 ? Math.round((totalParticipants / totalStudents) * 100) : 0;

        let analytics: any = {
            totalStudents,
            completedCount: completed.length,
            inProgressCount: inProgress.length,
            notStartedCount: notStarted.length,
            participationRate
        };

        if (completed.length > 0) {
            const scores = completed.map(s => s.score);
            const percentages = completed.map(s => s.percentage);
            const passingPercentage = test.config?.passingPercentage || 40;
            const passedCount = completed.filter(s => s.percentage >= passingPercentage).length;

            analytics = {
                ...analytics,
                averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
                highestScore: Math.max(...scores),
                lowestScore: Math.min(...scores),
                averagePercentage: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
                passRate: Math.round((passedCount / completed.length) * 100),
                passedCount,
                failedCount: completed.length - passedCount,
                medianScore: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
            };
        }

        return NextResponse.json({
            test: {
                title: test.title,
                totalMarks: test.totalMarks,
                duration: test.deployment?.durationMinutes,
                batches: test.deployment?.batches || []
            },
            analytics,
            completed,
            inProgress,
            notStarted
        });

    } catch (error: any) {
        console.error('Error fetching test results:', error);
        return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }
}
