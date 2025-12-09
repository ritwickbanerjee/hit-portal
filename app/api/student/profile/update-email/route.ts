
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, studentId } = await req.json();

        if (!email || !studentId) {
            return NextResponse.json({ error: 'Email and Student ID are required' }, { status: 400 });
        }

        // Verify Authentication
        let token = null;
        const cookieStore = req.headers.get('cookie');
        if (cookieStore) {
            const cookies = cookieStore.split(';').reduce((acc: any, cookie) => {
                const [k, v] = cookie.trim().split('=');
                acc[k] = v;
                return acc;
            }, {});
            token = cookies['auth_token'];
        }

        if (!token) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
            await jwtVerify(token, key);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        // Update Email
        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Check if email is already taken by ANOTHER student (optional but good practice)
        const existing = await Student.findOne({ email });
        if (existing && existing._id.toString() !== studentId) {
            return NextResponse.json({ error: 'This email is already linked to another student.' }, { status: 400 });
        }

        await Student.findByIdAndUpdate(studentId, { email });

        return NextResponse.json({ message: 'Email updated successfully' });

    } catch (error: any) {
        console.error('Update Email Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
