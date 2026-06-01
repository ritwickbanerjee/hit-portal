import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Submission from '@/models/Submission';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';
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

        let updatedQuestions = false;
        if (!submission.totalQuestions || submission.totalQuestions === 0) {
            const assignment = await Assignment.findById(submission.assignment);
            if (assignment) {
                if (assignment.type === 'personalized' || assignment.type === 'batch_attendance') {
                    const sa = await StudentAssignment.findOne({ studentId: submission.student, assignmentId: submission.assignment });
                    if (sa && sa.questionIds) submission.totalQuestions = sa.questionIds.length;
                } else if (assignment.type === 'randomized') {
                    const sa = await StudentAssignment.findOne({ studentId: submission.student, assignmentId: submission.assignment });
                    if (sa && sa.questionIds) submission.totalQuestions = sa.questionIds.length;
                    else if (assignment.questions) submission.totalQuestions = assignment.questions.length;
                } else if (assignment.questions) {
                    submission.totalQuestions = assignment.questions.length;
                }
                updatedQuestions = true;
                await submission.save();
            }
        }

        // Extract File ID from Drive Link
        const match = submission.driveLink.match(/\/d\/(.+?)\//);
        if (!match || !match[1]) {
            return NextResponse.json({ 
                error: 'Could not extract File ID from Drive link',
                totalQuestions: updatedQuestions ? submission.totalQuestions : undefined
            }, { status: 400 });
        }

        const fileId = match[1];
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        // Download the file
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            return NextResponse.json({ 
                error: 'Failed to download file from Google Drive',
                totalQuestions: updatedQuestions ? submission.totalQuestions : undefined
            }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        try {
            const pdfData = await pdfParse(buffer);
            const pageCount = pdfData.numpages;

            if (pageCount > 0) {
                submission.pageCount = pageCount;
                await submission.save();
                return NextResponse.json({ success: true, pageCount, totalQuestions: submission.totalQuestions });
            } else {
                return NextResponse.json({ 
                    error: 'Could not detect any pages in this file',
                    totalQuestions: submission.totalQuestions
                }, { status: 400 });
            }
        } catch (pdfErr: any) {
            return NextResponse.json({ 
                error: 'Failed to parse PDF: ' + pdfErr.message,
                totalQuestions: submission.totalQuestions
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Fetch Pages Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
