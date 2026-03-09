import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';
import StudentTestAttempt from '@/models/StudentTestAttempt';

// DELETE /api/admin/online-test/[id]/reassign
// Body: { phones: string[] }
// Deletes StudentTestAttempt records for the specified students so they can retake the test.
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id: testId } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify admin owns this test
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        const body = await request.json();
        const phones: string[] = body.phones;

        if (!Array.isArray(phones) || phones.length === 0) {
            return NextResponse.json({ error: 'No students selected' }, { status: 400 });
        }

        // Delete the attempt records for selected students
        const result = await StudentTestAttempt.deleteMany({
            testId,
            studentPhone: { $in: phones }
        });

        return NextResponse.json({
            message: `${result.deletedCount} student attempt(s) cleared. Students can now retake the test.`,
            deleted: result.deletedCount
        });
    } catch (error: any) {
        console.error('Error reassigning test:', error);
        return NextResponse.json({ error: 'Failed to reassign test' }, { status: 500 });
    }
}

// POST /api/admin/online-test/[id]/reassign
// Body: { newStartTime: string, newEndTime: string }
// Updates deployment times and sets status back to 'deployed' so missed students can take the test.
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id: testId } = await props.params;

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify admin owns this test
        const test = await OnlineTest.findOne({ _id: testId, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found' }, { status: 404 });
        }

        const body = await request.json();
        const { newStartTime, newEndTime } = body;

        if (!newStartTime || !newEndTime) {
            return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 });
        }

        const startStr = newStartTime.endsWith('Z') || newStartTime.includes('+') || newStartTime.includes('-')
            ? newStartTime : `${newStartTime}+05:30`;
        const start = new Date(startStr);

        const endStr = newEndTime.endsWith('Z') || newEndTime.includes('+') || newEndTime.includes('-')
            ? newEndTime : `${newEndTime}+05:30`;
        const end = new Date(endStr);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        if (end <= start) {
            return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
        }

        // Update deployment times and set status back to deployed
        test.deployment.startTime = start;
        test.deployment.endTime = end;
        test.status = 'deployed';

        await test.save();

        return NextResponse.json({
            message: 'Test reassigned successfully. Missed students can now take the test within the new time window.',
            startTime: start,
            endTime: end
        });
    } catch (error: any) {
        console.error('Error reassigning missed students:', error);
        return NextResponse.json({ error: 'Failed to reassign test' }, { status: 500 });
    }
}
