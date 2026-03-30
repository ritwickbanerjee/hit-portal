import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, email } = await req.json();

        if (!roll || !email) {
            return NextResponse.json({ error: 'Roll number and email are required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        if (student.isVerified) {
            return NextResponse.json({ error: 'Student already registered' }, { status: 400 });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB (overwrite existing if any for this email)
        await OTP.deleteMany({ email });
        // We might want to store roll number too, but OTP model might just have email?
        // Let's assume email is unique enough for the moment, or check OTP model.
        // If OTP model only has email, we rely on email.
        await OTP.create({ email, otp });

        // Send via Brevo
        const apiKey = process.env.BREVO_API_KEY?.trim();
        const senderEmail = process.env.SENDER_EMAIL?.trim();

        if (!apiKey || !senderEmail) {
            console.log('DEV MODE OTP:', otp);
            return NextResponse.json({
                message: 'OTP generated (Dev Mode)',
                dev_otp: otp // Returning valid OTP for dev simplicity
            });
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
                    sender: { email: senderEmail, name: 'Student Portal Support' },
                    to: [{ email: email, name: student.name }],
                    subject: 'Registration OTP - Student Portal',
                    htmlContent: `<p>Hello ${student.name},</p><p>Your OTP for registration is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Brevo Error:', errorData);
                throw new Error('Failed to send email');
            }
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            return NextResponse.json({ error: 'Failed to send OTP email' }, { status: 500 });
        }

        return NextResponse.json({ message: 'OTP sent successfully' });
    } catch (error: any) {
        console.error('Send OTP Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
