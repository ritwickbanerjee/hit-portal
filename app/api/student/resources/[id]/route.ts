import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Resource from '@/models/Resource';
import Question from '@/models/Question';
import Config from '@/models/Config';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();
        const { id } = await params;

        // Get the resource
        const resource = await Resource.findById(id);
        if (!resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Get the questions if any
        let questions: any[] = [];
        if (resource.questions && resource.questions.length > 0) {
            questions = await Question.find({ _id: { $in: resource.questions } });
        }

        // Check if AI is enabled for any of the question topics
        const config = await Config.findOne({});
        const aiEnabledTopics = new Set(config?.aiEnabledTopics || []);

        // Check if ANY question in this resource has an AI-enabled topic
        const hasAIEnabledTopic = questions.some(q => q.topic && aiEnabledTopics.has(q.topic));

        return NextResponse.json({
            resource: {
                _id: resource._id,
                title: resource.title,
                type: resource.type,
                url: resource.url,
                videoLink: resource.videoLink,
                targetCourse: resource.targetCourse || resource.course_code,
                facultyName: resource.facultyName,
                topic: resource.topic,
                subtopic: resource.subtopic,
                hints: resource.hints,
                aiEnabled: hasAIEnabledTopic // Send flag to frontend
            },
            questions: questions.map(q => ({
                _id: q._id,
                text: q.text,
                latex: q.latex,
                image: q.image,
                type: q.type,
                topic: q.topic,
                subtopic: q.subtopic,
            }))
        });

    } catch (error: any) {
        console.error('Fetch Resource Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
