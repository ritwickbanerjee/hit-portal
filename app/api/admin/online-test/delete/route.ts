import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        const test = await OnlineTest.findByIdAndDelete(id);

        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Test deleted successfully' });
    } catch (error) {
        console.error('Error deleting online test:', error);
        return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
    }
}
