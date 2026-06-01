import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Submission from '@/models/Submission';
import Student from '@/models/Student';
import Assignment from '@/models/Assignment';
import StudentAssignment from '@/models/StudentAssignment';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        // SECURE: Force studentId from token to prevent IDOR
        const studentId = req.headers.get('x-user-id');
        const { assignmentId, driveLink, pageCount, totalQuestions } = body;

        if (!assignmentId || !studentId || !driveLink) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Calculate total questions server-side to prevent client-side bug
        let finalTotalQuestions = totalQuestions || 0;

        const assignment = await Assignment.findById(assignmentId);
        if (assignment) {
            if (assignment.type === 'personalized' || assignment.type === 'batch_attendance') {
                const sa = await StudentAssignment.findOne({ studentId, assignmentId });
                if (sa && sa.questionIds) {
                    finalTotalQuestions = sa.questionIds.length;
                }
            } else if (assignment.type === 'randomized') {
                const sa = await StudentAssignment.findOne({ studentId, assignmentId });
                if (sa && sa.questionIds) {
                    finalTotalQuestions = sa.questionIds.length;
                } else if (assignment.questions) {
                     finalTotalQuestions = assignment.questions.length;
                }
            } else if (assignment.questions) {
                finalTotalQuestions = assignment.questions.length;
            }
        }

        // Check if submission already exists
        const existingSubmission = await Submission.findOne({
            assignment: assignmentId,
            student: studentId
        });

        if (existingSubmission) {
            // Update existing submission
            existingSubmission.driveLink = driveLink;
            if (pageCount !== undefined) existingSubmission.pageCount = pageCount;
            existingSubmission.totalQuestions = finalTotalQuestions;
            existingSubmission.submittedAt = new Date();
            await existingSubmission.save();

            return NextResponse.json({
                message: 'Submission updated',
                submission: existingSubmission
            });
        }

        // Create new submission
        const submission = await Submission.create({
            assignment: assignmentId,
            student: studentId,
            driveLink,
            pageCount: pageCount || 0,
            totalQuestions: finalTotalQuestions,
            submittedAt: new Date()
        });

        // Increment student's submission count
        await Student.findByIdAndUpdate(studentId, {
            $inc: { submissionCount: 1 }
        });

        return NextResponse.json({
            message: 'Submitted successfully',
            submission
        });

    } catch (error: any) {
        console.error('Submission Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
