import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, email, otp, password } = await req.json();

        if (!roll || !email || !otp || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        if (student.loginDisabled) {
            return NextResponse.json({ error: 'Your account has been disabled. Contact admin.' }, { status: 403 });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update student
        // If the email provided is different from institute email, save as secondary_email?
        // Or should we just trust it?
        // Let's safe-update secondary_email if it's new.
        const updates: any = {
            password: hashedPassword,
            isVerified: true,
        };

        if (student.email !== email) {
            updates.secondary_email = email;
        }

        await Student.updateOne({ _id: student._id }, updates);

        await OTP.deleteMany({ email });

        return NextResponse.json({ message: 'Registration successful' });

    } catch (error: any) {
        console.error('Registration Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
