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

        const student = await Student.findOne({ roll });

        if (!student) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        if (!student.isVerified) {
            return NextResponse.json(
                { error: 'Account not verified. Please register first.' },
                { status: 403 }
            );
        }

        if (student.loginDisabled) {
            return NextResponse.json(
                { error: 'Your account has been disabled. Contact admin.' },
                { status: 403 }
            );
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // AGGREGATION: Find ALL records for this student (same roll) to get all enrolled courses
        const allStudentDocs = await Student.find({ roll: student.roll });
        const allCourseCodes = allStudentDocs.map(doc => doc.course_code).filter(Boolean);

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
