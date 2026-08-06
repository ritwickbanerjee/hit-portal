import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import HtmlSubmission from '@/models/HtmlSubmission';
import Resource from '@/models/Resource';

export const runtime = 'nodejs';

// GET — check if a student has already submitted for a resource
// ?studentId=xxx&resourceId=yyy
// OR ?resourceId=yyy (returns count only, for public badge)
export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get('studentId');
        const resourceId = searchParams.get('resourceId');

        if (!resourceId) {
            return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
        }

        if (studentId) {
            // Check specific student
            const existing = await HtmlSubmission.findOne({ resourceId, studentId });
            return NextResponse.json({ submitted: !!existing, submission: existing || null });
        }

        // No studentId: return count
        const count = await HtmlSubmission.countDocuments({ resourceId });
        return NextResponse.json({ count });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — record a student submission
export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();

        const { resourceId, studentId, studentName, studentRoll, studentEmail, studentDepartment, studentYear } = body;

        if (!resourceId || !studentId || !studentName || !studentRoll) {
            return NextResponse.json({ error: 'resourceId, studentId, studentName and studentRoll are required' }, { status: 400 });
        }

        // Verify the resource actually exists
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Block re-submission — upsert with setOnInsert pattern
        const existing = await HtmlSubmission.findOne({ resourceId, studentId });
        if (existing) {
            return NextResponse.json({ error: 'Already submitted', submission: existing }, { status: 409 });
        }

        const submission = await HtmlSubmission.create({
            resourceId,
            resourceTitle: resource.title || '',
            studentId,
            studentName,
            studentRoll,
            studentEmail: studentEmail || '',
            studentDepartment: studentDepartment || '',
            studentYear: studentYear || '',
        });

        return NextResponse.json({ success: true, submission }, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            // Duplicate key — already submitted
            return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
