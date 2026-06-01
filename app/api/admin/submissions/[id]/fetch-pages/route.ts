import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Submission from '@/models/Submission';
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export const maxDuration = 60; // Set timeout to 60s
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        await connectDB();
        
        // Use Global Admin key or user authentication
        const isGlobalAdmin = req.headers.get('x-global-admin-key') === 'globaladmin_25';
        const userEmail = req.headers.get('x-user-email');
        const authHeader = req.headers.get('authorization');

        if (!isGlobalAdmin && !userEmail && !authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const submission = await Submission.findById(resolvedParams.id);
        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        if (!submission.driveLink) {
            return NextResponse.json({ error: 'No Google Drive link found for this submission' }, { status: 400 });
        }

        // Extract File ID from Drive Link
        const match = submission.driveLink.match(/\/d\/(.+?)\//);
        if (!match || !match[1]) {
            return NextResponse.json({ error: 'Could not extract File ID from Drive link' }, { status: 400 });
        }

        const fileId = match[1];
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        // Download the file
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to download file from Google Drive' }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
            const pdfData = await pdfParse(buffer);
            const pageCount = pdfData.numpages;

            if (pageCount > 0) {
                submission.pageCount = pageCount;
                await submission.save();
                return NextResponse.json({ success: true, pageCount });
            } else {
                return NextResponse.json({ error: 'Could not detect any pages in this file' }, { status: 400 });
            }
        } catch (pdfErr: any) {
            return NextResponse.json({ error: 'Failed to parse PDF: ' + pdfErr.message }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Fetch Pages Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
