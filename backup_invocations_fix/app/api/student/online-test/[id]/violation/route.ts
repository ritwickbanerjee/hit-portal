import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/db';
import StudentTestAttempt from '@/models/StudentTestAttempt';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id: testId } = await props.params;
        const { type, details } = await req.json();

        const token = req.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { payload } = await jwtVerify(token, key);
        const roll = payload.roll as string;

        if (!roll) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Find the active attempt for this student (using roll which is stored in studentPhone)
        const attempt = await StudentTestAttempt.findOne({
            testId,
            studentPhone: roll,
            status: 'in_progress'
        });

        if (!attempt) {
            // Second check: maybe it's already completed but we are logging a delayed terminal violation
            const completedAttempt = await StudentTestAttempt.findOne({
                testId,
                studentPhone: roll,
                status: 'completed'
            });
            if (!completedAttempt) {
                return NextResponse.json({ error: 'No attempt found' }, { status: 404 });
            }
            
            // Log to completed attempt
            completedAttempt.violations.push({
                type: type || 'proctoring_violation',
                timestamp: new Date(),
                details: details || 'Violation reported after submission'
            });

            if (type === 'window_switch') {
                completedAttempt.windowSwitchCount = (completedAttempt.windowSwitchCount || 0) + 1;
            } else if (type === 'screenshot') {
                completedAttempt.screenshotCount = (completedAttempt.screenshotCount || 0) + 1;
            }

            await completedAttempt.save();
        } else {
            // Add violation to active attempt
            attempt.violations.push({
                type: type || 'proctoring_violation',
                timestamp: new Date(),
                details: details || ''
            });

            if (type === 'window_switch') {
                attempt.windowSwitchCount = (attempt.windowSwitchCount || 0) + 1;
                attempt.warningCount = (attempt.warningCount || 0) + 1;
            } else if (type === 'screenshot') {
                attempt.screenshotCount = (attempt.screenshotCount || 0) + 1;
                attempt.warningCount = (attempt.warningCount || 0) + 1;
            }
            
            await attempt.save();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error logging violation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
