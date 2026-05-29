
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email } = await req.json(); // studentId from body is IGNORED

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // SECURE: Middleware verifies token and injects x-user-id.
        // We rely on that or re-verify if paranoid.
        // For consistency with other routes, let's use the header if available, or fall back to strict check.
        // Actually, let's trust the Middleware + Header for IDOR fix.

        let userId = req.headers.get('x-user-id');

        // Fallback for direct calls bypassing middleware (unlikely but safe)
        if (!userId) {
            // ... existing token logic could stay, but let's assume middleware config is correct.
            // If middleware didn't run, x-user-id is missing => 401.
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = userId; // Override body studentId

        // Update Email
        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Check if email is already taken by ANOTHER student (optional but good practice)
        const existing = await Student.findOne({ email });
        if (existing && existing._id.toString() !== studentId) {
            return NextResponse.json({ error: 'This email is already linked to another student.' }, { status: 400 });
        }

        await Student.findByIdAndUpdate(studentId, { email });

        return NextResponse.json({ message: 'Email updated successfully' });

    } catch (error: any) {
        console.error('Update Email Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
