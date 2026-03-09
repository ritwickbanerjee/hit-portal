import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/db';
import StudentTestAttempt from '@/models/StudentTestAttempt';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

async function getStudentFromToken(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, key);
        return { phoneNumber: (payload.phoneNumber || payload.userId) as string };
    } catch {
        return null;
    }
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const student = await getStudentFromToken(req);
        if (!student) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const { id: testId } = await props.params;

        const attempt = await StudentTestAttempt.findOne({
            testId,
            studentPhone: student.phoneNumber,
            status: 'in_progress'
        });

        if (!attempt) {
            return NextResponse.json({ error: 'No active attempt' }, { status: 404 });
        }

        // Increment warning count
        attempt.warningCount = (attempt.warningCount || 0) + 1;
        await attempt.save();

        return NextResponse.json({
            success: true,
            warningCount: attempt.warningCount
        });

    } catch (error: any) {
        console.error('Error updating warning count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
