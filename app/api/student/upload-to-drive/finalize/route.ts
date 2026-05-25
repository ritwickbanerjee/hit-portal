import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import UploadChunk from '@/models/UploadChunk';

export async function POST(req: Request) {
    try {
        await connectDB();

        const { uploadId, scriptUrl, fileName, folderPath } = await req.json();

        if (!uploadId || !scriptUrl || !fileName || !folderPath) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Retrieve all chunks in order
        const chunks = await UploadChunk.find({ uploadId }).sort({ chunkIndex: 1 });

        if (chunks.length === 0) {
            return NextResponse.json({ error: 'No chunks found for this upload' }, { status: 404 });
        }

        const expectedTotal = chunks[0].totalChunks;
        if (chunks.length !== expectedTotal) {
            return NextResponse.json({
                error: `Incomplete upload: ${chunks.length}/${expectedTotal} chunks received`,
                storedCount: chunks.length,
                totalChunks: expectedTotal
            }, { status: 400 });
        }

        // Verify chunk sequence is complete (0, 1, 2, ... N-1)
        for (let i = 0; i < chunks.length; i++) {
            if (chunks[i].chunkIndex !== i) {
                return NextResponse.json({
                    error: `Missing chunk at index ${i}`,
                }, { status: 400 });
            }
        }

        // 2. Stitch base64 data
        const fullFileData = chunks.map(c => c.data).join('');

        // 3. Upload to Google Drive via Apps Script
        const gasResponse = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: fullFileData, fileName, folderPath }),
            redirect: 'follow',
        });

        const gasText = await gasResponse.text();

        // Check if we got HTML instead of JSON (permission error)
        if (gasText.includes('<!DOCTYPE html>') || gasText.includes('<html') || gasResponse.status === 401 || gasResponse.status === 403) {
            console.error('Received HTML/Permission error instead of JSON from Google Script');
            console.error('Script URL:', scriptUrl);
            return NextResponse.json({
                error: 'Google Script Permission Error',
                message: 'The faculty\'s Google Drive upload script is not properly configured. Please deploy the Google Apps Script with "Execute as: Me" and "Who has access: Anyone" settings.',
                details: 'Received permission error or HTML page instead of JSON response'
            }, { status: 502 });
        }

        let gasResult;
        try {
            gasResult = JSON.parse(gasText);
        } catch {
            // Sometimes GAS returns HTML on error
            console.error('GAS non-JSON response:', gasText.substring(0, 500));
            return NextResponse.json({
                error: 'Invalid response from Google Apps Script',
                details: gasText.substring(0, 200)
            }, { status: 502 });
        }

        if (gasResult.status !== 'success' || !gasResult.driveLink) {
            return NextResponse.json({
                error: gasResult.message || gasResult.error || 'Drive upload failed',
                gasResult
            }, { status: 502 });
        }

        // 4. Clean up chunks from DB
        await UploadChunk.deleteMany({ uploadId });

        return NextResponse.json({
            status: 'success',
            driveLink: gasResult.driveLink,
            message: 'File uploaded successfully'
        });

    } catch (error: any) {
        console.error('Finalize upload error:', error);
        return NextResponse.json({ error: error.message || 'Finalize failed' }, { status: 500 });
    }
}
