import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export async function POST(req: Request) {
    try {
        await connectDB();

        // Delete ALL mock test configs
        const result = await MockTestConfig.deleteMany({});

        console.log('[CLEANUP] Deleted', result.deletedCount, 'mock test configs');

        return NextResponse.json({
            success: true,
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} old mock test configurations`
        });
    } catch (error: any) {
        console.error('[CLEANUP] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
