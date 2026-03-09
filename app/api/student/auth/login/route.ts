import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, password } = await req.json();

        if (!roll || !password) {
            return NextResponse.json({ error: 'Roll number and password are required' }, { status: 400 });
        }

        const students = await Student.find({ roll });

        if (students.length === 0) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Check if ALL accounts are disabled
        const allDisabled = students.every(doc => doc.loginDisabled);
        if (allDisabled) {
            return NextResponse.json(
                { error: 'Your account has been disabled for all courses. Contact admin.' },
                { status: 403 }
            );
        }

        // Find an active AND verified account to authenticate against
        // We prioritize verified accounts. If multiple exist, any is fine (assuming same password).
        const activeVerifiedStudent = students.find(s => !s.loginDisabled && s.isVerified);

        if (!activeVerifiedStudent) {
            // Check if there are active but unverified accounts
            const activeUnverified = students.some(s => !s.loginDisabled);
            if (activeUnverified) {
                return NextResponse.json(
                    { error: 'Account not verified. Please register first.' },
                    { status: 403 }
                );
            }
            // Should be covered by allDisabled check, but fallback
            return NextResponse.json(
                { error: 'Account disabled.' },
                { status: 403 }
            );
        }

        const isMatch = await bcrypt.compare(password, activeVerifiedStudent.password);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Mark all records for this roll as having logged in (first-time login tracking)
        await Student.updateMany({ roll }, { $set: { hasLoggedIn: true } });

        // Use the authenticated student record for ID, but aggregate courses
        const student = activeVerifiedStudent;

        // Filter only ACTIVE courses from ALL records
        const activeStudentDocs = students.filter(doc => !doc.loginDisabled);
        const allCourseCodes = activeStudentDocs
            .map(doc => doc.course_code)
            .filter(code => code && !code.startsWith('DISABLED_'));

        // Create JWT Token
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod'
        );
        const alg = 'HS256';

        const token = await new SignJWT({
            userId: student._id.toString(),
            role: 'student',
            roll: student.roll
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secret);

        const response = NextResponse.json({
            user: {
                _id: student._id,
                roll: student.roll,
                name: student.name,
                email: student.email,
                department: student.department,
                year: student.year,
                course_code: allCourseCodes,
                role: 'student',
            },
            token
        });

        response.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return response;

    } catch (error) {
        console.error('Student Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
