import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    try {
        // No auth required - students need to check which topics are enabled
        await connectDB();
        const db = mongoose.connection.db;

        if (!db) {
            throw new Error("Database not connected");
        }

        const config = await db.collection('configs').findOne({});

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

        await connectDB();
        const db = mongoose.connection.db;

        if (!db) {
            throw new Error("Database not connected");
        }

        await db.collection('configs').updateOne(
            {},
            { $set: { aiEnabledTopics: enabledTopics } },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving AI settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
