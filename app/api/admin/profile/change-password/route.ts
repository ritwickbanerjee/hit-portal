import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function POST(req: Request) {
    try {
        await connectDB();
        const { currentPassword, newPassword } = await req.json();

        // Auth Check
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

        let userId;
        try {
            const { payload } = await jwtVerify(token, key);
            userId = payload.userId;
        } catch (err) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify Current Password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
        }

        // Update Password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return NextResponse.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error('Change Password Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
