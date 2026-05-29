
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Attendance from '@/models/Attendance';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const course = searchParams.get('course') || 'MTH1102';

        const records = await Attendance.find({ course_code: course }).sort({ date: 1 });

        return NextResponse.json(records);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
