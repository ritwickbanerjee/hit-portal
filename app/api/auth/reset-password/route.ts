import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, otp, newPassword } = await req.json();

        if (!email || !otp || !newPassword) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Must explicitly select OTP fields as they are select: false
        const user = await User.findOne({ email }).select('+otp +otpExpiry');

        if (!user) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        if (!user.otp || !user.otpExpiry) {
            return NextResponse.json({ error: 'No OTP request found' }, { status: 400 });
        }

        if (new Date() > user.otpExpiry) {
            return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
        }

        const isMatch = await bcrypt.compare(otp, user.otp);
        if (!isMatch) {
            return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
        }

        // Use standard bcrypt.hash - reusing the same salt rounds as other parts of the app if known, or default 10
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return NextResponse.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
