import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import OTP from '@/models/OTP';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { roll, email } = await req.json();

        if (!roll || !email) {
            return NextResponse.json({ error: 'Roll number and Email are required' }, { status: 400 });
        }

        // 1. Check if student exists in Admin DB
        const student = await Student.findOne({ roll });
        if (!student) {
            return NextResponse.json({ error: 'Student record not found. Please contact Admin.' }, { status: 404 });
        }

        // 2. Security Check: SKIPPED
        // We allow students to provide their own email if the admin one is missing/wrong.
        // The OTP verification ensures they own the email they provided.
        const providedEmail = email.toLowerCase().trim();
        const studentEmail = student.email ? student.email.toLowerCase() : '';

        // Log mismatch for audit but allow proceed
        if (studentEmail && studentEmail !== providedEmail) {
            console.log(`[Registration] Email mismatch: Admin(${studentEmail}) vs User(${providedEmail}). proceeding...`);
        }

        // 3. Check if already registered
        if (student.isVerified) {
            return NextResponse.json({ error: 'Account already registered. Please Login.' }, { status: 400 });
        }

        // 3.5 Check if EMAIL is already used by ANOTHER verified student
        // We look for any student who:
        // - Is Verified
        // - HAS this email (either as primary or secondary)
        // - Is NOT the current student (check by roll)
        const emailExists = await Student.findOne({
            $and: [
                {
                    $or: [
                        { email: providedEmail },
                        { secondary_email: providedEmail }
                    ]
                },
                { isVerified: true },
                { roll: { $ne: roll } } // Don't block if self (shouldn't happen due to isVerified check above, but for safety)
            ]
        });

        if (emailExists) {
            return NextResponse.json({ error: 'This email is already in use by another student.' }, { status: 400 });
        }

        // 4. Generate & Send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP
        await OTP.deleteMany({ email: providedEmail });
        await OTP.create({ email: providedEmail, otp });

        // Send Email (Brevo)
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.SENDER_EMAIL;

        if (!apiKey || !senderEmail) {
            console.log('DEV MODE REGISTRATION OTP:', otp);
            return NextResponse.json({ message: 'OTP sent (Dev Mode)' });
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { email: senderEmail, name: 'Student Portal' },
                to: [{ email: providedEmail, name: student.name }],
                subject: 'Registration OTP',
                htmlContent: `<p>Hello ${student.name},</p><p>Your OTP for registration is: <strong>${otp}</strong></p>`,
            }),
        });

        if (!response.ok) {
            console.error('Brevo Error:', await response.json());
            return NextResponse.json({ error: 'Failed to send OTP email' }, { status: 500 });
        }

        return NextResponse.json({ message: 'OTP sent successfully to your email' });

    } catch (error: any) {
        console.error('Register OTP Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
