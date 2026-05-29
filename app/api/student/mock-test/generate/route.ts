import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Question from '@/models/Question';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { facultyName, topics } = await req.json();

        if (!facultyName || !topics || !Array.isArray(topics) || topics.length === 0) {
            return NextResponse.json({ error: 'Faculty name and topics array are required' }, { status: 400 });
        }

        const selectedQuestions: any[] = [];
        let totalMarks = 0;

        // For each topic, select 3 questions
        for (const topic of topics) {
            // Fetch all questions for this topic and faculty
            const allQuestions = await Question.find({ facultyName, topic });

            // Separate by type
            const mcqQuestions = allQuestions.filter(q => q.type === 'mcq');
            const blanksQuestions = allQuestions.filter(q => q.type === 'blanks');
            const broadQuestions = allQuestions.filter(q => q.type === 'broad');

            // Select 1 from MCQ or Blanks (randomly choose which pool)
            const mcqOrBlankPool = [...mcqQuestions, ...blanksQuestions];
            if (mcqOrBlankPool.length > 0) {
                const randomIndex = Math.floor(Math.random() * mcqOrBlankPool.length);
                selectedQuestions.push({
                    ...mcqOrBlankPool[randomIndex].toObject(),
                    marks: 1,
                    topic
                });
                totalMarks += 1;
            }

            // Select 2 Broad questions
            if (broadQuestions.length >= 2) {
                // Shuffle and pick 2
                const shuffled = broadQuestions.sort(() => 0.5 - Math.random());
                selectedQuestions.push({
                    ...shuffled[0].toObject(),
                    marks: 6,
                    topic
                });
                selectedQuestions.push({
                    ...shuffled[1].toObject(),
                    marks: 6,
                    topic
                });
                totalMarks += 12;
            } else if (broadQuestions.length === 1) {
                // Only 1 broad available
                selectedQuestions.push({
                    ...broadQuestions[0].toObject(),
                    marks: 6,
                    topic
                });
                totalMarks += 6;
            }
        }

        // Shuffle all selected questions
        const shuffledQuestions = selectedQuestions.sort(() => 0.5 - Math.random());

        // Calculate time in minutes (marks * 2.5)
        const timeMinutes = Math.ceil(totalMarks * 2.5);

        return NextResponse.json({
            questions: shuffledQuestions,
            totalMarks,
            timeMinutes,
            topics: topics
        });
    } catch (error) {
        console.error('Generate Questions Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
