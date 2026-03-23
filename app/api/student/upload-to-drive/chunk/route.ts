import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UploadChunk from '@/models/UploadChunk';

export async function POST(req: Request) {
    try {
        await connectDB();

        const { uploadId, chunkIndex, totalChunks, data, studentId, assignmentId } = await req.json();

        if (!uploadId || chunkIndex === undefined || !totalChunks || !data || !studentId || !assignmentId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
            return NextResponse.json({ error: 'Invalid chunk index' }, { status: 400 });
        }

        // Upsert the chunk (idempotent - safe for retries)
        await UploadChunk.findOneAndUpdate(
            { uploadId, chunkIndex },
            { uploadId, chunkIndex, totalChunks, data, studentId, assignmentId, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Check how many chunks are stored for this upload
        const storedCount = await UploadChunk.countDocuments({ uploadId });

        return NextResponse.json({
            status: 'chunk_received',
            chunkIndex,
            storedCount,
            totalChunks,
            complete: storedCount === totalChunks
        });

    } catch (error: any) {
        console.error('Chunk upload error:', error);
        return NextResponse.json({ error: error.message || 'Chunk upload failed' }, { status: 500 });
    }
}
