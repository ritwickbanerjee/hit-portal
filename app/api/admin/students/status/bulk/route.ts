import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { ids, disabled } = await req.json();

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
        }

        await Student.updateMany(
            { _id: { $in: ids } },
            { $set: { loginDisabled: disabled } }
        );

        return NextResponse.json({ message: 'Status updated successfully' });
    } catch (error) {
        console.error('Bulk status update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
