import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import StudentAssignment from '@/models/StudentAssignment';
import Question from '@/models/Question';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get('studentId');
        const assignmentId = searchParams.get('assignmentId');

        if (!studentId || !assignmentId) {
            return NextResponse.json({ error: 'studentId and assignmentId are required' }, { status: 400 });
        }

        // Find the student assignment record
        const studentAssignment = await StudentAssignment.findOne({
            studentId,
            assignmentId
        });

        if (!studentAssignment || !studentAssignment.questionIds || studentAssignment.questionIds.length === 0) {
            return NextResponse.json({ questions: [], message: 'No questions assigned' });
        }

        // Fetch the full question documents
        const questions = await Question.find({
            _id: { $in: studentAssignment.questionIds }
        });

        return NextResponse.json({ questions });
    } catch (error) {
        console.error('Error fetching student questions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
