import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import FacultyConfig from '@/models/FacultyConfig';

export const runtime = 'nodejs';

export async function GET() {
    await connectDB();
    const configs = await FacultyConfig.find({});
    return NextResponse.json(configs);
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const { facultyName, rootFolderId, scriptUrl } = await req.json();

        const config = await FacultyConfig.findOneAndUpdate(
            { facultyName },
            { facultyName, rootFolderId, scriptUrl },
            { upsert: true, new: true }
        );

        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
