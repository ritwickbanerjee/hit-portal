import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { email, password } = await req.json();

        const user = await User.findOne({ email });

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Create JWT Token
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod'
        );
        const alg = 'HS256';

        const token = await new SignJWT({
            userId: user._id.toString(),
            role: user.role, // 'student' or 'admin'
            email: user.email
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('24h') // Token expires in 24 hours
            .sign(secret);

        // Set Cookie
        const response = NextResponse.json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            token,
        });

        response.cookies.set({
            name: 'auth_token',
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
