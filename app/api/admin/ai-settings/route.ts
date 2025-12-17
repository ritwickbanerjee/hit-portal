import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'HIT_Portal';

export async function GET(req: NextRequest) {
    try {
        // No auth required - students need to check which topics are enabled
        const client = await MongoClient.connect(MONGO_URI);
        const db = client.db(DB_NAME);

        const config = await db.collection('configs').findOne({});

        await client.close();

        const enabledTopics = config?.aiEnabledTopics || [];
        return NextResponse.json({ enabledTopics });
    } catch (error) {
        console.error('Error fetching AI settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const email = req.headers.get('X-User-Email');
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { enabledTopics } = await req.json();

        if (!Array.isArray(enabledTopics)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const client = await MongoClient.connect(MONGO_URI);
        const db = client.db(DB_NAME);

        await db.collection('configs').updateOne(
            {},
            { $set: { aiEnabledTopics: enabledTopics } },
            { upsert: true }
        );

        await client.close();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving AI settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
