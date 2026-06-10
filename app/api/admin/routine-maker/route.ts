import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Routine from '@/models/Routine';
import Config from '@/models/Config';

export const runtime = 'nodejs';

async function isAuthorized(req: NextRequest) {
    const email = req.headers.get('x-user-email') || '';
    if (!email) return false;
    await connectDB();
    const config = await Config.findOne({ key: 'data' });
    const authorized: string[] = config?.routineMakerAuthorizedEmails || ['ritwick92@gmail.com'];
    return authorized.map((e: string) => e.toLowerCase()).includes(email.toLowerCase());
}

// GET: List all routines
export async function GET(req: NextRequest) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const routines = await Routine.find({ isArchived: { $ne: true } })
            .select('name description createdBy createdAt updatedAt')
            .sort({ updatedAt: -1 });
        return NextResponse.json(routines);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create new routine
export async function POST(req: NextRequest) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, description, faculties, mappingRules, grid } = body;
        const email = req.headers.get('x-user-email') || '';

        const routine = await Routine.create({
            name: name || 'Untitled Routine',
            description: description || '',
            createdBy: email,
            ...(faculties && { faculties }),
            ...(mappingRules && { mappingRules }),
            ...(grid && { grid }),
        });

        return NextResponse.json(routine, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
