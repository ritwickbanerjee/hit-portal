import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const SUPER_ADMIN_EMAIL = 'ritwick92@gmail.com';

function isSuperAdmin(req: Request) {
    const email = req.headers.get('X-User-Email') || '';
    return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// GET: List all admin users
export async function GET(req: Request) {
    if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const admins = await User.find({ role: 'admin' }, { password: 0, otp: 0, otpExpiry: 0 }).sort({ createdAt: -1 });
    return NextResponse.json({ admins });
}

// POST: Create a new admin user with a random password
export async function POST(req: Request) {
    if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { email, name } = await req.json();
    if (!email || !name) {
        return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    // Generate a strong random password
    const randomPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10).toUpperCase() + '!';
    const hashed = await bcrypt.hash(randomPassword, 10);
    await User.create({
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: hashed,
        role: 'admin',
    });
    // Return the plaintext password once so the super-admin can share it
    return NextResponse.json({ message: 'Admin created successfully. Share the temporary password below.', tempPassword: randomPassword });
}

// DELETE: Remove an admin user by ID
export async function DELETE(req: Request) {
    if (!isSuperAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { id } = await req.json();
    if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    const user = await User.findById(id);
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return NextResponse.json({ error: 'Cannot delete the super admin account' }, { status: 403 });
    }
    await User.findByIdAndDelete(id);
    return NextResponse.json({ message: 'Admin deleted successfully' });
}
