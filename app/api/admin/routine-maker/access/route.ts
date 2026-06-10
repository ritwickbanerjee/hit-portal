import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Config from '@/models/Config';
import User from '@/models/User';

export const runtime = 'nodejs';

const SUPER_ADMIN = 'ritwick92@gmail.com';

function isSuperAdmin(email: string) {
    return email.toLowerCase() === SUPER_ADMIN.toLowerCase();
}

// GET: Check access or list all admins with their authorization status
export async function GET(req: NextRequest) {
    const email = req.headers.get('x-user-email') || '';
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const config = await Config.findOne({ key: 'data' });
    const authorized: string[] = config?.routineMakerAuthorizedEmails || [SUPER_ADMIN];
    const normalizedAuth = authorized.map(e => e.toLowerCase());

    // Check mode: just check if current user has access
    const { searchParams } = new URL(req.url);
    if (searchParams.get('check') === 'true') {
        return NextResponse.json({
            hasAccess: normalizedAuth.includes(email.toLowerCase()),
            isSuperAdmin: isSuperAdmin(email),
        });
    }

    // Full listing mode: only super admin
    if (!isSuperAdmin(email)) {
        return NextResponse.json({ error: 'Only RB can manage access' }, { status: 403 });
    }

    // Get all admin users
    const admins = await User.find({ role: 'admin' }).select('name email');
    const adminList = admins.map((a: any) => ({
        name: a.name,
        email: a.email,
        hasAccess: normalizedAuth.includes(a.email.toLowerCase()),
        isSuperAdmin: isSuperAdmin(a.email),
    }));

    return NextResponse.json(adminList);
}

// POST: Toggle access for an admin (super admin only)
export async function POST(req: NextRequest) {
    const email = req.headers.get('x-user-email') || '';
    if (!isSuperAdmin(email)) {
        return NextResponse.json({ error: 'Only RB can manage access' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { targetEmail, grant } = body;

    if (!targetEmail) {
        return NextResponse.json({ error: 'targetEmail is required' }, { status: 400 });
    }

    // Cannot revoke super admin's own access
    if (isSuperAdmin(targetEmail) && !grant) {
        return NextResponse.json({ error: 'Cannot revoke super admin access' }, { status: 400 });
    }

    const config = await Config.findOne({ key: 'data' });
    if (!config) {
        return NextResponse.json({ error: 'Config not found' }, { status: 500 });
    }

    let authorized: string[] = config.routineMakerAuthorizedEmails || [SUPER_ADMIN];
    const normalizedTarget = targetEmail.toLowerCase();

    if (grant) {
        if (!authorized.map((e: string) => e.toLowerCase()).includes(normalizedTarget)) {
            authorized.push(targetEmail);
        }
    } else {
        authorized = authorized.filter((e: string) => e.toLowerCase() !== normalizedTarget);
    }

    // Ensure super admin is always in the list
    if (!authorized.map((e: string) => e.toLowerCase()).includes(SUPER_ADMIN.toLowerCase())) {
        authorized.push(SUPER_ADMIN);
    }

    config.routineMakerAuthorizedEmails = authorized;
    await config.save();

    return NextResponse.json({ message: `Access ${grant ? 'granted' : 'revoked'} for ${targetEmail}` });
}
