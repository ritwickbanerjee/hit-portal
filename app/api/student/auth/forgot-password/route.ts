import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll } = await req.json();

        if (!roll) {
            return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
        }

        const student = await Student.findOne({ roll });
        if (!student) {
            // Return success even if student not found to prevent enumeration? 
            // Or specific error since roll numbers are public/guessable?
            // Existing flow seems to be explicit about errors, but let's be safe-ish or helpful.
            // The frontend expects "OTP sent" or error.
            // If we return error "Student not found", it helps the user know they typed it wrong.
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to DB (overwrite existing if any for this email)
        // We use the student's institute email for OTP
        await OTP.deleteMany({ email: student.email });
        await OTP.create({ email: student.email, otp });

        // Send via Brevo
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.SENDER_EMAIL;

        if (!apiKey || !senderEmail) {
            console.log('DEV MODE STUDENT FORGOT PASSWORD OTP:', otp);
            return NextResponse.json({
                message: 'OTP sent (Dev Mode)',
                dev_otp: otp
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
                    sender: { email: senderEmail, name: 'Portal Support' },
                    to: [{ email: student.email, name: student.name }],
                    subject: 'Password Reset OTP',
                    htmlContent: `<p>Hello ${student.name},</p><p>Your OTP for password reset is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p>`,
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
        console.error('Student Forgot Password Error:', error);
        return NextResponse.json(
            { error: 'Server error', details: error.message },
            { status: 500 }
        );
    }
}
