import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { ids } = await req.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const result = await Student.deleteMany({
            _id: { $in: ids }
        });

        return NextResponse.json({
            message: `Deleted ${result.deletedCount} students`,
            deletedCount: result.deletedCount
        });
    } catch (error: any) {
        console.error('Bulk delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
