import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import Student from '@/models/Student';
import StudentTestAttempt from '@/models/StudentTestAttempt';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return {
            userId: payload.userId as string,
            roll: payload.roll as string,
            courses: payload.courses as string[] || []
        };
    } catch {
        return null;
    }
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// GET - Fetch test for taking (strips answers)
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

        const test = await OnlineTest.findById(testId);
        if (!test || test.status !== 'deployed') {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Check student is in a deployed batch by checking if test deployment matches any active enrollment
        const studentDocs = await Student.find({ roll: student.roll, loginDisabled: { $ne: true } }).lean();
        
        const hasAccess = studentDocs.some((doc: any) => {
            const deptMatch = test.deployment?.department?.includes(doc.department);
            const yearMatch = test.deployment?.year === doc.year;
            const courseMatch = test.deployment?.course === doc.course_code;
            return deptMatch && yearMatch && courseMatch;
        });

        if (!hasAccess) {
            return NextResponse.json({ error: 'You do not have access to this test' }, { status: 403 });
        }

        // Check time window
        const now = new Date();
        const startTime = test.deployment?.startTime ? new Date(test.deployment.startTime) : null;
        const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;

        // Check for existing attempt
        let attempt = await StudentTestAttempt.findOne({ testId, studentPhone: student.roll });

        if (attempt && attempt.status === 'in_progress') {
            attempt.resumeCount = (attempt.resumeCount || 0) + 1;

            if (attempt.resumeCount > 1) { // They are resuming for the SECOND time
                // Auto-grade their latest saved answers
                const sourceQuestions = (attempt.questions && attempt.questions.length > 0) ? attempt.questions : test.questions;
                const questionMap = new Map<string, any>();
                for (const q of sourceQuestions) {
                    questionMap.set(q.id, q);
                    if (q.type === 'comprehension' && q.subQuestions) {
                        for (const sq of q.subQuestions) questionMap.set(sq.id, sq);
                    }
                }

                let totalScore = 0;
                const gradedAnswers: any[] = [];
                const attemptAnswers = attempt.answers || [];

                for (const ans of attemptAnswers) {
                    const question = questionMap.get(ans.questionId);
                    if (!question) {
                        gradedAnswers.push({ questionId: ans.questionId, answer: ans.answer, isCorrect: false, marksAwarded: 0 });
                        continue;
                    }

                    let isCorrect = false;
                    let marksAwarded = 0;

                    if (question.type === 'mcq') {
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
                            const cleanAnswer = String(ans.answer).replace(/\s+/g, '');
                            const numAnswer = parseFloat(cleanAnswer);
                            const min = question.numberRangeMin ?? 0;
                            const max = question.numberRangeMax ?? 0;
                            isCorrect = !isNaN(numAnswer) && numAnswer >= min && numAnswer <= max;
                        } else {
                            const studentAns = question.caseSensitive ? String(ans.answer).trim().replace(/\s+/g, ' ') : String(ans.answer).trim().toLowerCase().replace(/\s+/g, ' ');
                            const correctAns = question.caseSensitive ? String(question.fillBlankAnswer).trim().replace(/\s+/g, ' ') : String(question.fillBlankAnswer).trim().toLowerCase().replace(/\s+/g, ' ');
                            isCorrect = studentAns === correctAns;
                        }
                        marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
                    } else if (question.type === 'broad') {
                        isCorrect = false;
                        marksAwarded = 0;
                    }

                    if (ans.answer === null || ans.answer === undefined || ans.answer === '' ||
                        (Array.isArray(ans.answer) && ans.answer.length === 0)) {
                        marksAwarded = 0;
                        isCorrect = false;
                    }
                    totalScore += marksAwarded;
                    gradedAnswers.push({
                        questionId: ans.questionId,
                        answer: ans.answer,
                        isCorrect,
                        marksAwarded,
                        timeTaken: ans.timeTaken || 0
                    });
                }

                totalScore = Math.max(0, totalScore);
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

                attempt.answers = gradedAnswers;
                attempt.score = totalScore;
                attempt.percentage = percentage;
                attempt.timeSpent = attempt.timeSpent || (Date.now() - new Date(attempt.startedAt).getTime());
                attempt.status = 'completed';
                attempt.submittedAt = new Date();
                attempt.terminationReason = 'max_resumes_exceeded';

                await attempt.save();

                return NextResponse.json({
                    error: 'Maximum resume limit exceeded. Test has been automatically submitted.',
                    status: 'completed',
                    redirect: true
                }, { status: 403 });
            } else {
                await attempt.save();
            }
        }

        // If no attempt yet and test hasn't started, return test info only
        if (!attempt && startTime && now < startTime) {
            return NextResponse.json({
                error: 'Test has not started yet',
                startsAt: startTime
            }, { status: 400 });
        }

        // Determine source of questions
        let sourceQuestions = [];
        if (attempt && attempt.questions && attempt.questions.length > 0) {
            sourceQuestions = attempt.questions;
        } else {
            sourceQuestions = test.questions;
        }

        // Strip answers from questions
        let questions = sourceQuestions.map((q: any) => {
            const stripped: any = {
                id: q.id,
                text: q.text,
                image: q.image,
                latexContent: q.latexContent,
                type: q.type,
                topic: q.topic,
                subtopic: q.subtopic,
                marks: q.marks,
                negativeMarks: q.negativeMarks,
                shuffleOptions: q.shuffleOptions,
                timeLimit: q.timeLimit
            };

            if (q.type === 'mcq' || q.type === 'msq') {
                stripped.options = q.options;
                // Don't include correctIndices!
            } else if (q.type === 'fillblank') {
                stripped.caseSensitive = q.caseSensitive;
                stripped.isNumberRange = q.isNumberRange;
                // Don't include fillBlankAnswer, numberRangeMin, numberRangeMax!
            } else if (q.type === 'comprehension') {
                stripped.comprehensionText = q.comprehensionText;
                stripped.comprehensionImage = q.comprehensionImage;
                stripped.subQuestions = q.subQuestions?.map((sq: any) => {
                    const subStripped: any = {
                        id: sq.id,
                        text: sq.text,
                        image: sq.image,
                        latexContent: sq.latexContent,
                        type: sq.type,
                        marks: sq.marks,
                        negativeMarks: sq.negativeMarks,
                        timeLimit: sq.timeLimit
                    };
                    if (sq.type === 'mcq' || sq.type === 'msq') {
                        subStripped.options = sq.options;
                    }
                    if (sq.type === 'fillblank') {
                        subStripped.caseSensitive = sq.caseSensitive;
                        subStripped.isNumberRange = sq.isNumberRange;
                    }
                    return subStripped;
                });
            }
            // Broad type: just text, no answers to strip

            return stripped;
        });

        // Shuffle questions if configured AND using original test questions (not attempt snapshot)
        // If it's an attempt snapshot, order is preserved from creation
        if (!attempt && test.config?.shuffleQuestions) {
            questions = shuffleArray(questions);
        }

        return NextResponse.json({
            test: {
                _id: test._id,
                title: test.title,
                description: test.description,
                totalMarks: test.totalMarks,
                durationMinutes: test.deployment?.durationMinutes,
                startTime: test.deployment?.startTime,
                endTime: test.deployment?.endTime,
                config: test.config,
                questions
            },
            attempt: attempt ? {
                status: attempt.status,
                startedAt: attempt.startedAt,
                answers: attempt.answers,
                timeSpent: attempt.timeSpent,
                warningCount: attempt.warningCount || 0,
                resumeCount: attempt.resumeCount || 0
            } : null
        });
    } catch (error: any) {
        console.error('Error fetching test for student:', error);
        return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 });
    }
}

// POST - Start a test attempt
export async function POST(
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

        const test = await OnlineTest.findById(testId);
        if (!test || test.status !== 'deployed') {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Check access by matching any active profile against test deployment
        const studentDocs = await Student.find({ roll: student.roll, loginDisabled: { $ne: true } }).lean();
        const dbStudent = studentDocs[0] as any;
        
        const hasAccess = studentDocs.some((doc: any) => {
            const deptMatch = test.deployment?.department?.includes(doc.department);
            const yearMatch = test.deployment?.year === doc.year;
            const courseMatch = test.deployment?.course === doc.course_code;
            return deptMatch && yearMatch && courseMatch;
        });

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Check if already attempted
        let attempt = await StudentTestAttempt.findOne({ testId, studentPhone: student.roll });
        if (attempt) {
            if (attempt.status === 'completed') {
                return NextResponse.json({ error: 'You have already completed this test' }, { status: 400 });
            }
            // Already in progress - return existing attempt
            return NextResponse.json({ attempt, message: 'Resuming existing attempt' });
        }

        // Prepare questions for this attempt
        let attemptQuestions = [...test.questions];

        // 1. Shuffle if maxQuestionsToAttempt is set OR shuffleQuestions is true
        // If max questions is set, we MUST shuffle to get a random subset
        if (test.config?.maxQuestionsToAttempt || test.config?.shuffleQuestions) {
            attemptQuestions = shuffleArray(attemptQuestions);
        }

        // 2. Slice if maxQuestionsToAttempt is set
        if (test.config?.maxQuestionsToAttempt && test.config.maxQuestionsToAttempt > 0) {
            attemptQuestions = attemptQuestions.slice(0, test.config.maxQuestionsToAttempt);
        }

        // Create new attempt
        const batchName = dbStudent?.course_code || '';
        attempt = new StudentTestAttempt({
            testId,
            studentEmail: student.roll, // Legacy field mapping
            studentPhone: student.roll,
            studentName: dbStudent?.name || 'Unknown',
            batchName,
            status: 'in_progress',
            startedAt: new Date(),
            answers: [],
            questions: attemptQuestions, // Store the snapshot of questions!
            score: 0,
            percentage: 0,
            timeSpent: 0,
            warningCount: 0
        });

        await attempt.save();

        // Strip answers for the response (same logic as GET)
        const strippedQuestions = attemptQuestions.map((q: any) => {
            const stripped: any = {
                id: q.id,
                text: q.text,
                image: q.image,
                latexContent: q.latexContent,
                type: q.type,
                topic: q.topic,
                subtopic: q.subtopic,
                marks: q.marks,
                negativeMarks: q.negativeMarks,
                shuffleOptions: q.shuffleOptions,
                timeLimit: q.timeLimit
            };

            if (q.type === 'mcq' || q.type === 'msq') {
                stripped.options = q.options;
            } else if (q.type === 'fillblank') {
                stripped.caseSensitive = q.caseSensitive;
                stripped.isNumberRange = q.isNumberRange;
            } else if (q.type === 'comprehension') {
                stripped.comprehensionText = q.comprehensionText;
                stripped.comprehensionImage = q.comprehensionImage;
                stripped.subQuestions = q.subQuestions?.map((sq: any) => {
                    const subStripped: any = {
                        id: sq.id,
                        text: sq.text,
                        image: sq.image,
                        latexContent: sq.latexContent,
                        type: sq.type,
                        marks: sq.marks,
                        negativeMarks: sq.negativeMarks,
                        timeLimit: sq.timeLimit
                    };
                    if (sq.type === 'mcq' || sq.type === 'msq') {
                        subStripped.options = sq.options;
                    }
                    if (sq.type === 'fillblank') {
                        subStripped.caseSensitive = sq.caseSensitive;
                        subStripped.isNumberRange = sq.isNumberRange;
                    }
                    return subStripped;
                });
            }
            return stripped;
        });

        return NextResponse.json({
            attempt,
            questions: strippedQuestions, // Return the randomized questions
            message: 'Test started successfully'
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error starting test:', error);
        return NextResponse.json({ error: 'Failed to start test' }, { status: 500 });
    }
}

// PUT - Submit test answers
export async function PUT(
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
        const body = await req.json();
        const { answers, timeSpent, terminationReason } = body;

        // Find the attempt
        const attempt = await StudentTestAttempt.findOne({
            testId,
            studentPhone: student.roll,
            status: 'in_progress'
        });

        if (!attempt) {
            return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
        }

        // Get the test for grading
        const test = await OnlineTest.findById(testId);
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Build question lookup from the ATTEMPT's questions (which may be a subset)
        // This ensures scoring uses the actually-served questions, not the full pool
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

        // Auto-grade each answer
        let totalScore = 0;
        const gradedAnswers: any[] = [];

        for (const ans of answers) {
            const question = questionMap.get(ans.questionId);
            if (!question) {
                gradedAnswers.push({ questionId: ans.questionId, answer: ans.answer, isCorrect: false, marksAwarded: 0 });
                continue;
            }

            let isCorrect = false;
            let marksAwarded = 0;

            if (question.type === 'mcq') {
                // MCQ: single correct answer (index)
                if (question.correctIndices && question.correctIndices.length > 0) {
                    const studentIdx = (ans.answer !== null && ans.answer !== undefined) ? parseInt(ans.answer) : -1;
                    isCorrect = question.correctIndices.includes(studentIdx);
                }
                marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
            } else if (question.type === 'msq') {
                // MSQ: multiple correct answers (array of indices)
                if (question.correctIndices && Array.isArray(ans.answer)) {
                    const correctIndices = question.correctIndices.map((i: any) => parseInt(i));
                    const studentIndices = ans.answer.map((i: any) => parseInt(i));
                    const correctSet = new Set(correctIndices);
                    const studentSet = new Set(studentIndices);
                    isCorrect = correctSet.size === studentSet.size && [...correctSet].every(i => studentSet.has(i));
                }
                marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
            } else if (question.type === 'fillblank') {
                if (question.isNumberRange) {
                    const cleanAnswer = String(ans.answer).replace(/\s+/g, '');
                    const numAnswer = parseFloat(cleanAnswer);
                    const min = question.numberRangeMin ?? 0;
                    const max = question.numberRangeMax ?? 0;
                    isCorrect = !isNaN(numAnswer) && numAnswer >= min && numAnswer <= max;
                } else {
                    const studentAns = question.caseSensitive ? String(ans.answer).trim().replace(/\s+/g, ' ') : String(ans.answer).trim().toLowerCase().replace(/\s+/g, ' ');
                    const correctAns = question.caseSensitive ? String(question.fillBlankAnswer).trim().replace(/\s+/g, ' ') : String(question.fillBlankAnswer).trim().toLowerCase().replace(/\s+/g, ' ');
                    isCorrect = studentAns === correctAns;
                }
                marksAwarded = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
            } else if (question.type === 'broad') {
                // Broad questions: cannot auto-grade, mark as pending
                isCorrect = false;
                marksAwarded = 0;
            }

            // Don't let negative marks go below 0 total (applied per question)
            if (ans.answer === null || ans.answer === undefined || ans.answer === '' ||
                (Array.isArray(ans.answer) && ans.answer.length === 0)) {
                // Unanswered: no marks, no negative
                marksAwarded = 0;
                isCorrect = false;
            }

            totalScore += marksAwarded;
            gradedAnswers.push({
                questionId: ans.questionId,
                answer: ans.answer,
                isCorrect,
                marksAwarded,
                timeTaken: ans.timeTaken || 0
            });
        }

        // Ensure score doesn't go below 0
        totalScore = Math.max(0, totalScore);
        // Calculate totalMarks from the served questions (not the full pool)
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
        const totalMarks = servedTotalMarks || test.totalMarks || 1;
        const percentage = Math.round((totalScore / totalMarks) * 100);

        // Update attempt
        attempt.answers = gradedAnswers;
        attempt.score = totalScore;
        attempt.percentage = percentage;
        attempt.timeSpent = timeSpent || (Date.now() - new Date(attempt.startedAt).getTime());
        attempt.status = 'completed';
        attempt.submittedAt = new Date();
        if (body.warningCount !== undefined) attempt.warningCount = body.warningCount;
        if (terminationReason) attempt.terminationReason = terminationReason;

        await attempt.save();

        const showResultsImmediately = test.config?.showResultsImmediately ?? true;
        const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;
        const resultsPending = !showResultsImmediately && endTime ? new Date() < endTime : false;

        return NextResponse.json({
            message: 'Test submitted successfully',
            score: resultsPending ? null : totalScore,
            totalMarks: resultsPending ? null : totalMarks,
            percentage: resultsPending ? null : percentage,
            passed: resultsPending ? null : (percentage >= (test.config?.passingPercentage || 40)),
            resultsPending
        });
    } catch (error: any) {
        console.error('Error submitting test:', error);
        return NextResponse.json({ error: 'Failed to submit test' }, { status: 500 });
    }
}

// PATCH - Auto-save answers without grading (for periodic save & pagehide beacon)
export async function PATCH(
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
        const body = await req.json();
        const { answers, timeSpent } = body;

        if (!answers || !Array.isArray(answers)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Find the active attempt
        const attempt = await StudentTestAttempt.findOne({
            testId,
            studentPhone: student.roll,
            status: 'in_progress'
        });

        if (!attempt) {
            return NextResponse.json({ error: 'No active attempt' }, { status: 404 });
        }

        // Save answers without grading (raw answer data only)
        // Merge with existing answers — update existing, add new
        const existingMap = new Map<string, any>();
        if (attempt.answers && attempt.answers.length > 0) {
            for (const a of attempt.answers) {
                existingMap.set(a.questionId, a);
            }
        }
        for (const a of answers) {
            existingMap.set(a.questionId, {
                questionId: a.questionId,
                answer: a.answer,
                isCorrect: false,  // Not graded yet
                marksAwarded: 0,
                timeTaken: a.timeTaken || existingMap.get(a.questionId)?.timeTaken || 0
            });
        }

        attempt.answers = Array.from(existingMap.values());
        if (timeSpent) attempt.timeSpent = timeSpent;
        await attempt.save();

        return NextResponse.json({ success: true, savedCount: answers.length });
    } catch (error: any) {
        console.error('Error auto-saving answers:', error);
        return NextResponse.json({ error: 'Failed to auto-save' }, { status: 500 });
    }
}
