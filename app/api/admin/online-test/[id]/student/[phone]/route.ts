import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import BatchStudent from '@/models/BatchStudent';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string, phone: string }> }
) {
    try {
        await connectDB();
        const { id: testId, phone } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find test and verify ownership
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail }).lean();
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Get student details
        const student = await BatchStudent.findOne({ phoneNumber: phone }).lean();

        // Get attempt
        const attempt = await StudentTestAttempt.findOne({ testId, studentPhone: phone }).lean();

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        return NextResponse.json({
            student: {
                name: student?.name || attempt.studentName || 'Unknown',
                phone: attempt.studentPhone,
                batch: attempt.batchName
            },
            attempt: {
                ...attempt,
                // ensure questions from the test are available if attempt doesn't have a snapshot
                questions: (attempt.questions && attempt.questions.length > 0) ? attempt.questions : test.questions
            }
        });

    } catch (error: any) {
        console.error('Error fetching student attempt details:', error);
        return NextResponse.json({ error: 'Failed to fetch student attempt details' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string, phone: string }> }
) {
    try {
        await connectDB();
        const { id: testId, phone } = await props.params;
        const { adjustments } = await request.json(); // Array of { questionId, adjustmentMarks }

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find test and verify ownership
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        // Get attempt
        const attempt = await StudentTestAttempt.findOne({ testId, studentPhone: phone });
        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        // Update adjustments
        let totalScore = 0;
        const adjMap = new Map(adjustments.map((a: any) => [a.questionId, a.adjustmentMarks]));

        for (const ans of attempt.answers) {
            // Check if there is a new adjustment for this question
            if (adjMap.has(ans.questionId)) {
                // We use any because adjustmentMarks might not be in the strict TypeScript schema type yet
                (ans as any).adjustmentMarks = Number(adjMap.get(ans.questionId)) || 0;
            }

            // Re-sum the score
            const adjustment = (ans as any).adjustmentMarks || 0;
            totalScore += (ans.marksAwarded || 0) + adjustment;
        }

        // Calculate total marks served to this student (for percentage calculation)
        const sourceQuestions = (attempt.questions && attempt.questions.length > 0) ? attempt.questions : test.questions;
        let servedTotalMarks = 0;
        for (const q of sourceQuestions) {
            if (q.type === 'comprehension' && q.subQuestions) {
                for (const sq of q.subQuestions) servedTotalMarks += sq.marks || 1;
            } else servedTotalMarks += q.marks || 1;
        }
        const tm = servedTotalMarks || test.totalMarks || 1;

        attempt.score = Math.max(0, totalScore); // prevent negative total score
        attempt.percentage = Math.round((attempt.score / tm) * 100);

        // Tell mongoose that the answers array was modified since it contains mixed types
        attempt.markModified('answers');
        await attempt.save();

        return NextResponse.json({ message: 'Adjustment marks saved successfully', score: attempt.score, percentage: attempt.percentage });

    } catch (error: any) {
        console.error('Error saving adjustment marks:', error);
        return NextResponse.json({ error: 'Failed to save adjustment marks' }, { status: 500 });
    }
}
