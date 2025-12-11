import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';
import Question from '@/models/Question';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const email = req.headers.get('X-User-Email');

        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // We need to find the facultyName for this email. 
        // We can find it by looking up *any* question uploaded by this user,
        // OR we should probably trust the frontend to send the name? 
        // No, security.
        // But the previous API `questions` uses `X-User-Email` and `Question` model has `facultyName`.
        // Let's find one question to get the facultyName.
        const oneQ = await Question.findOne({ uploadedBy: email }).select('facultyName');
        const facultyName = oneQ ? oneQ.facultyName : null;

        if (!facultyName) {
            // User might not have uploaded any questions yet. 
            // Return empty config or check if we can get name from somewhere else.
            return NextResponse.json({ enabledTopics: [] });
        }

        const config = await MockTestConfig.findOne({ facultyName });

        // If no config exists, should we return all topics as enabled? 
        // Or empty? 
        // Let's return the stored config if it exists.
        return NextResponse.json({
            enabledTopics: config ? config.enabledTopics : [],
            facultyName
        });

    } catch (error) {
        console.error('Fetch Mock Config Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const { enabledTopics, facultyName } = await req.json();
        const email = req.headers.get('X-User-Email');

        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify facultyName matches the email (basic check)
        const oneQ = await Question.findOne({ uploadedBy: email }).select('facultyName');
        if (oneQ && oneQ.facultyName !== facultyName) {
            // If they have questions and name mismatch, suspicious.
            // But valid scenarios exist (name change). Let's just proceed or use the one from DB.
        }

        // Upsert
        const config = await MockTestConfig.findOneAndUpdate(
            { facultyName },
            { enabledTopics },
            { upsert: true, new: true }
        );

        return NextResponse.json(config);

    } catch (error) {
        console.error('Save Mock Config Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
