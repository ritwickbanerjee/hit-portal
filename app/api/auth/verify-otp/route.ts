import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, otp, newPassword } = await req.json();

        const otpRecord = await OTP.findOne({ email, otp });
        if (!otpRecord) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const updatedStudent = await Student.findOneAndUpdate(
            {
                $or: [
                    { email: email },
                    { secondary_email: email }
                ]
            },
            { password: hashedPassword, isVerified: true }
        );

        if (!updatedStudent) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        await OTP.deleteMany({ email }); // Clear OTPs

        return NextResponse.json({ message: 'Password reset successfully' });

    } catch (error: any) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
