import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;
        return { phoneNumber, studentName: payload.studentName as string };
    } catch {
        return null;
    }
}

// GET - Fetch student's own result + detailed analysis
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const student = await getStudentFromToken(req);
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const { id: testId } = await props.params;

        // Get student's attempt
        const attempt = await StudentTestAttempt.findOne({
            testId,
            studentPhone: student.phoneNumber,
            status: 'completed'
        });

        if (!attempt) {
            return NextResponse.json({ error: 'No completed attempt found' }, { status: 404 });
        }

        // Get the test (with answers this time for review)
        const test = await OnlineTest.findById(testId);
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Check if results should be shown
        const showResults = test.config?.showResults ?? true;
        const showResultsImmediately = test.config?.showResultsImmediately ?? true;

        if (!showResults) {
            return NextResponse.json({
                error: 'Results are not available for this test',
                score: attempt.score,
                percentage: attempt.percentage,
                totalMarks: test.totalMarks,
                resultsHidden: true
            }, { status: 200 });
        }

        // Check for deadline-based visibility (only block if showResultsImmediately is false)
        const now = new Date();
        const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;

        if (!showResultsImmediately && (!endTime || now < endTime)) {
            const dateStr = endTime ? endTime.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                timeZone: 'Asia/Kolkata'
            }) : 'a later date';

            const timeStr = endTime ? endTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata'
            }) : '';

            return NextResponse.json({
                error: `Results will be declared after the deadline`,
                score: null, // Redact score
                percentage: null,
                totalMarks: test.totalMarks,
                resultsHidden: true,
                resultsPending: true, // Specific flag for frontend
                message: endTime
                    ? `Come back at ${dateStr} & ${timeStr} to view your results.`
                    : `Results will be declared by the administrator later.`
            }, { status: 200 });
        }

        // Build question map from attempt's questions (accounts for random subsets)
        const sourceQuestions = (attempt.questions && attempt.questions.length > 0)
            ? attempt.questions
            : test.questions;

        const questionMap = new Map<string, any>();
        for (const q of sourceQuestions) {
            questionMap.set(q.id, q);
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) {
                    questionMap.set(sq.id, sq);
                }
            }
        }

        // Compute actual total marks from served questions
        let servedTotalMarks = 0;
        for (const q of sourceQuestions) {
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) {
                    servedTotalMarks += sq.marks || 1;
                }
            } else {
                servedTotalMarks += q.marks || 1;
            }
        }
        const actualTotalMarks = servedTotalMarks || test.totalMarks;

        // Build detailed question-by-question review
        const questionReview = attempt.answers.map((ans: any) => {
            const question = questionMap.get(ans.questionId);
            if (!question) return null;

            const review: any = {
                questionId: ans.questionId,
                text: question.text,
                image: question.image,
                latexContent: question.latexContent,
                type: question.type,
                marks: question.marks,
                negativeMarks: question.negativeMarks,
                studentAnswer: ans.answer,
                isCorrect: ans.isCorrect,
                marksAwarded: ans.marksAwarded,
                isGraceAwarded: ans.isGraceAwarded || question.isGrace, // Fallback to question def
                topic: question.topic,
                subtopic: question.subtopic,
                solutionText: question.solutionText,
                solutionImage: question.solutionImage
            };

            // Include correct answers for review
            if (question.type === 'mcq' || question.type === 'msq') {
                review.options = question.options;
                review.correctIndices = question.correctIndices;
            } else if (question.type === 'fillblank') {
                review.correctAnswer = question.fillBlankAnswer;
                review.caseSensitive = question.caseSensitive;
                review.isNumberRange = question.isNumberRange;
                if (question.isNumberRange) {
                    review.numberRangeMin = question.numberRangeMin;
                    review.numberRangeMax = question.numberRangeMax;
                }
            } else if (question.type === 'comprehension') {
                review.comprehensionText = question.comprehensionText;
                review.comprehensionImage = question.comprehensionImage;
            }

            return review;
        }).filter(Boolean);

        // Topic-wise analysis
        const topicStats = new Map<string, { correct: number; total: number; marks: number; maxMarks: number }>();
        for (const qr of questionReview) {
            const topic = qr.topic || 'Uncategorized';
            if (!topicStats.has(topic)) {
                topicStats.set(topic, { correct: 0, total: 0, marks: 0, maxMarks: 0 });
            }
            const stats = topicStats.get(topic)!;
            stats.total++;
            stats.maxMarks += qr.marks || 0;
            if (qr.isCorrect) {
                stats.correct++;
                stats.marks += qr.marksAwarded || 0;
            }
        }

        const topicAnalysis = Array.from(topicStats.entries()).map(([topic, stats]) => ({
            topic,
            ...stats,
            percentage: stats.maxMarks > 0 ? Math.round((stats.marks / stats.maxMarks) * 100) : 0
        }));

        // Calculate rank: Number of people with higher score + 1
        const betterScoresCount = await StudentTestAttempt.countDocuments({
            testId,
            status: 'completed',
            score: { $gt: attempt.score }
        });
        const rank = betterScoresCount + 1;

        // Get total students assigned to this test (deployed batches)
        const assignedStudentDocs = await BatchStudent.find({ courses: { $in: test.deployment?.batches || [] } }).select('phoneNumber').lean() as any[];

        // Count all completed attempts as fallback for total
        const completedAttemptsCount = await StudentTestAttempt.countDocuments({ testId, status: 'completed' });
        const totalStudents = assignedStudentDocs.length > 0 ? assignedStudentDocs.length : completedAttemptsCount;

        // Get topper score for this test
        const topperAttempt = await StudentTestAttempt.findOne({
            testId,
            status: 'completed'
        }).sort({ score: -1 }).select('score percentage').lean();
        const topperScore = (topperAttempt as any)?.score || attempt.score;
        const topperPercentage = (topperAttempt as any)?.percentage || attempt.percentage;

        // Summary stats
        const correctCount = questionReview.filter((q: any) => q.isCorrect).length;
        const incorrectCount = questionReview.filter((q: any) => !q.isCorrect && q.studentAnswer !== null && q.studentAnswer !== undefined && q.studentAnswer !== '' && !(Array.isArray(q.studentAnswer) && q.studentAnswer.length === 0)).length;
        const unansweredCount = questionReview.length - correctCount - incorrectCount;

        // Fetch Leaderboard (Top 10)
        const topAttempts = await StudentTestAttempt.find({
            testId,
            status: 'completed'
        })
            .sort({ score: -1, timeSpent: 1 })
            .limit(10)
            .select('studentName studentPhone score percentage timeSpent submittedAt')
            .lean();

        const leaderboard = topAttempts.map((att: any, index: number) => ({
            rank: index + 1,
            name: att.studentName || 'Unknown Student', // Show full name
            score: att.score,
            percentage: Math.round(att.percentage || 0),
            timeSpent: att.timeSpent,
            submittedAt: att.submittedAt,
            isCurrentUser: att.studentPhone === student.phoneNumber
        }));

        return NextResponse.json({
            test: {
                title: test.title,
                description: test.description,
                totalMarks: actualTotalMarks,
                durationMinutes: test.deployment?.durationMinutes,
                passingPercentage: test.config?.passingPercentage || 40
            },
            result: {
                score: attempt.score,
                percentage: attempt.percentage,
                timeSpent: attempt.timeSpent,
                submittedAt: attempt.submittedAt,
                graceMarks: attempt.graceMarks,
                graceReason: attempt.graceReason,
                passed: attempt.percentage >= (test.config?.passingPercentage || 40),
                rank,
                totalStudents,
                topperScore,
                topperPercentage: Math.round(topperPercentage),
                correctCount,
                incorrectCount,
                unansweredCount,
                leaderboard
            },
            questionReview,
            topicAnalysis
        });
    } catch (error: any) {
        console.error('Error fetching student result:', error);
        return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
    }
}
