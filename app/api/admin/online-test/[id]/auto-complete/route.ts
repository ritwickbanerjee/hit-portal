import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';

/**
 * POST /api/admin/online-test/[id]/auto-complete
 * 
 * Server-side auto-completion for stuck "in_progress" test attempts.
 * Finds all in_progress attempts where either:
 *   1. startedAt + durationMinutes has elapsed, OR
 *   2. Current time > test endTime
 * 
 * Auto-grades with whatever answers exist and marks them as completed
 * with terminationReason: 'server_auto_expired'.
 */
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const userEmail = req.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const { id: testId } = await props.params;

        // Verify test exists and ownership
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        const now = new Date();
        const durationMs = (test.deployment?.durationMinutes || 60) * 60 * 1000;
        const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;

        // Find all in_progress attempts for this test
        const stuckAttempts = await StudentTestAttempt.find({
            testId,
            status: 'in_progress'
        });

        if (stuckAttempts.length === 0) {
            return NextResponse.json({ message: 'No stuck attempts found', completedCount: 0 });
        }

        // Build question map for grading
        const questionMap = new Map<string, any>();
        for (const q of test.questions) {
            questionMap.set(q.id, q);
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) {
                    questionMap.set(sq.id, sq);
                }
            }
        }

        let completedCount = 0;

        for (const attempt of stuckAttempts) {
            const startedAt = new Date(attempt.startedAt).getTime();
            const elapsed = now.getTime() - startedAt;
            const isExpiredByDuration = elapsed > durationMs;
            const isExpiredByEndTime = endTime ? now > endTime : false;

            if (!isExpiredByDuration && !isExpiredByEndTime) continue;

            // Use the attempt's own question snapshot for grading if available
            const sourceQuestions = (attempt.questions && attempt.questions.length > 0)
                ? attempt.questions
                : test.questions;

            const attemptQuestionMap = new Map<string, any>();
            for (const q of sourceQuestions) {
                attemptQuestionMap.set(q.id, q);
                if (q.type === 'comprehension' && q.subQuestions) {
                    for (const sq of q.subQuestions) {
                        attemptQuestionMap.set(sq.id, sq);
                    }
                }
            }

            // Grade existing answers
            let totalScore = 0;
            const gradedAnswers: any[] = [];

            for (const ans of (attempt.answers || [])) {
                const question = attemptQuestionMap.get(ans.questionId);
                if (!question) {
                    gradedAnswers.push({ questionId: ans.questionId, answer: ans.answer, isCorrect: false, marksAwarded: 0 });
                    continue;
                }

                let isCorrect = false;
                let marksAwarded = 0;

                if (ans.answer === null || ans.answer === undefined || ans.answer === '' ||
                    (Array.isArray(ans.answer) && ans.answer.length === 0)) {
                    marksAwarded = 0;
                    isCorrect = false;
                } else if (question.type === 'mcq') {
                    if (question.correctIndices && question.correctIndices.length > 0) {
                        isCorrect = question.correctIndices[0] === ans.answer;
                    }
                    marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                } else if (question.type === 'msq') {
                    if (question.correctIndices && Array.isArray(ans.answer)) {
                        const correct = new Set(question.correctIndices);
                        const selected = new Set(ans.answer);
                        isCorrect = correct.size === selected.size && [...correct].every(i => selected.has(i));
                    }
                    marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                } else if (question.type === 'fillblank') {
                    if (question.isNumberRange) {
                        const numAnswer = parseFloat(ans.answer);
                        isCorrect = !isNaN(numAnswer) && numAnswer >= (question.numberRangeMin ?? 0) && numAnswer <= (question.numberRangeMax ?? 0);
                    } else {
                        const studentAns = question.caseSensitive ? String(ans.answer).trim() : String(ans.answer).trim().toLowerCase();
                        const correctAns = question.caseSensitive ? String(question.fillBlankAnswer).trim() : String(question.fillBlankAnswer).trim().toLowerCase();
                        isCorrect = studentAns === correctAns;
                    }
                    marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                }

                totalScore += marksAwarded;
                gradedAnswers.push({ questionId: ans.questionId, answer: ans.answer, isCorrect, marksAwarded });
            }

            totalScore = Math.max(0, totalScore);

            // Calculate total marks from served questions
            let servedTotalMarks = 0;
            for (const q of sourceQuestions) {
                if (q.type === 'comprehension' && q.subQuestions) {
                    for (const sq of q.subQuestions) servedTotalMarks += sq.marks || 1;
                } else {
                    servedTotalMarks += q.marks || 1;
                }
            }
            const totalMarks = servedTotalMarks || test.totalMarks || 1;
            const percentage = Math.round((totalScore / totalMarks) * 100);

            // Update attempt
            attempt.answers = gradedAnswers;
            attempt.score = totalScore;
            attempt.percentage = percentage;
            attempt.status = 'completed';
            attempt.submittedAt = now;
            attempt.timeSpent = attempt.timeSpent || elapsed;
            attempt.terminationReason = 'server_auto_expired';
            await attempt.save();

            completedCount++;
        }

        return NextResponse.json({
            message: `Auto-completed ${completedCount} expired attempt(s)`,
            completedCount
        });
    } catch (error: any) {
        console.error('Error auto-completing expired tests:', error);
        return NextResponse.json({ error: 'Failed to auto-complete' }, { status: 500 });
    }
}
