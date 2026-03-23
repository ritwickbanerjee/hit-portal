import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import Student from '@/models/Student';

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

// GET - List all tests available to this student
export async function GET(req: NextRequest) {
    try {
        const studentToken = await getStudentFromToken(req);
        if (!studentToken || !studentToken.roll) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        // 1b. Determine selected batch (default to ALL active enrollments if not specified)
        const requestedBatch = req.nextUrl.searchParams.get('batch');
        
        // Build precise target conditions based on enrollments
        let targetDocs = studentDocs;
        if (requestedBatch) {
            targetDocs = studentDocs.filter((doc: any) => doc.course_code === requestedBatch);
        }

        if (targetDocs.length === 0) {
            return NextResponse.json({ available: [], upcoming: [], completed: [], expired: [] });
        }

        const orConditions = targetDocs.map((doc: any) => ({
             'deployment.department': doc.department,
             'deployment.year': doc.year,
             'deployment.course': doc.course_code
        }));

        // Find all deployed tests matching any of their enrollments
        const tests = await OnlineTest.find({
            status: 'deployed',
            $or: orConditions
        }).select('-questions.correctIndices -questions.fillBlankAnswer -questions.numberRangeMin -questions.numberRangeMax')
            .sort({ 'deployment.startTime': -1 });

        // Get all student's attempts
        const testIds = tests.map(t => t._id.toString());
        const attempts = await StudentTestAttempt.find({
            testId: { $in: testIds },
            studentPhone: studentToken.roll
        });
        const attemptMap = new Map<string, any>();
        attempts.forEach(a => attemptMap.set(a.testId.toString(), a));

        const now = new Date();
        const available: any[] = [];
        const upcoming: any[] = [];
        const completed: any[] = [];
        const expired: any[] = [];

        for (const test of tests) {
            const startTime = test.deployment?.startTime ? new Date(test.deployment.startTime) : null;
            const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;
            const attempt = attemptMap.get(test._id.toString());

            // Determine result visibility: only pending if showResultsImmediately is false AND before deadline
            const showResults = test.config?.showResults ?? true;
            const showResultsImmediately = test.config?.showResultsImmediately ?? true;

            // FIX: Pending if: Global ShowResult is FALSE, OR (Deferred AND Before Deadline)
            const isDeferred = !showResultsImmediately && (!endTime || now < endTime);
            const resultsPending = !showResults || isDeferred;

            const testInfo = {
                _id: test._id,
                title: test.title,
                description: test.description,
                totalMarks: test.totalMarks,
                questionCount: (test.config?.maxQuestionsToAttempt && test.config.maxQuestionsToAttempt > 0)
                    ? test.config.maxQuestionsToAttempt
                    : (test.questions?.length || 0),
                durationMinutes: test.deployment?.durationMinutes,
                startTime: test.deployment?.startTime,
                endTime: test.deployment?.endTime,
                config: test.config,
                attemptStatus: attempt?.status || 'not_started',
                score: resultsPending ? null : attempt?.score,
                percentage: resultsPending ? null : attempt?.percentage,
                submittedAt: attempt?.submittedAt,
                resultsPending
            };

            if (attempt?.status === 'completed') {
                completed.push(testInfo);
            } else if (startTime && now < startTime) {
                upcoming.push(testInfo);
            } else if (endTime && now > endTime && (!attempt || attempt.status === 'not_started')) {
                expired.push(testInfo);
            } else if (
                (!startTime || now >= startTime) &&
                (!endTime || now <= endTime)
            ) {
                available.push(testInfo);
            } else if (attempt?.status === 'in_progress') {
                available.push(testInfo);
            } else {
                expired.push(testInfo);
            }
        }

        return NextResponse.json({ available, upcoming, completed, expired });
    } catch (error: any) {
        console.error('Error fetching student tests:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}
