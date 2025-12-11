import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Question from '@/models/Question';
import MockTestConfig from '@/models/MockTestConfig';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const facultyName = searchParams.get('facultyName');

        if (!facultyName) {
            return NextResponse.json({ error: 'Faculty name is required' }, { status: 400 });
        }

        // 1. Fetch config for this faculty
        const config = await MockTestConfig.findOne({ facultyName });
        const enabledTopics = config ? config.enabledTopics : [];

        // If no topics enabled (or no config), return empty immediately?
        // Or should we fetch questions anyway to validate?
        // Let's return intersection.

        if (!config || enabledTopics.length === 0) {
            return NextResponse.json([]);
        }

        // 2. Fetch all unique topics for this faculty (to ensure we only return valid ones that have questions)
        const questions = await Question.find({ facultyName }).select('topic');
        const allTopics = [...new Set(questions.map(q => q.topic))];

        // 3. Filter
        const validEnabledTopics = allTopics.filter(t => enabledTopics.includes(t)).sort();

        return NextResponse.json(validEnabledTopics);
    } catch (error) {
        console.error('Fetch Topics Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
