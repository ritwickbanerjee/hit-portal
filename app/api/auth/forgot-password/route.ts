import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Return success even if user not found to prevent enumeration
            return NextResponse.json({ message: 'If this email exists, an OTP has been sent.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Update User
        user.otp = otpHash;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send Email
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.SENDER_EMAIL;

        if (!apiKey || !senderEmail) {
            console.log('DEV MODE AUTH OTP:', otp);
            return NextResponse.json({ message: 'OTP sent (Dev Mode)', dev_otp: otp });
        }

        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    sender: { email: senderEmail, name: 'Portal Admin Support' },
                    to: [{ email: user.email, name: user.name }],
                    subject: 'Password Reset OTP',
                    htmlContent: `<p>Hello ${user.name},</p><p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This OTP is valid for 10 minutes.</p>`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Brevo Error:', errorData);
                return NextResponse.json(
                    { error: 'Failed to send OTP email', details: errorData },
                    { status: 500 }
                );
            }
        } catch (emailError: any) {
            console.error('Email sending failed:', emailError);
            return NextResponse.json(
                { error: 'Failed to send OTP email', details: emailError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: 'OTP sent successfully' });
    } catch (error: any) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json(
            { error: 'Server error', details: error.message },
            { status: 500 }
        );
    }
}
