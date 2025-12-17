import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Config from '@/models/Config';

export async function GET() {
    try {
        await connectDB();
        let config = await Config.findOne({});

        if (!config) {
            config = await Config.create({
                key: 'data',
                attendanceRequirement: 70,
                attendanceRules: {},
                teacherAssignments: {},
                aiEnabledTopics: []
            });
        }

        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        console.log('Updating config with:', JSON.stringify(body, null, 2));

        const config = await Config.findOneAndUpdate({}, { $set: body }, { new: true, upsert: true });
        return NextResponse.json(config);
    } catch (error: any) {
        console.error('Config update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
