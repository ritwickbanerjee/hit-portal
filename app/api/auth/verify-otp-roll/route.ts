import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, otp, newPassword } = await req.json();

        if (!roll || !otp || !newPassword) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // We check OTP against both emails just in case? Or just regex check?
        // Since OTP is stored by email, we need to know WHICH email it was sent to.
        // The forgot-password API sends to both (or preferred).
        // Let's check if OTP exists for either email.

        const otpRecord = await OTP.findOne({
            $or: [
                { email: student.email, otp },
                { email: student.secondary_email, otp }
            ]
        });

        if (!otpRecord) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Student.findByIdAndUpdate(
            student._id,
            { password: hashedPassword, isVerified: true }
        );

        // Clear OTPs for both emails
        await OTP.deleteMany({
            $or: [
                { email: student.email },
                { email: student.secondary_email }
            ]
        });

        return NextResponse.json({ message: 'Password reset successfully' });

    } catch (error: any) {
        console.error('Verify OTP Roll Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
