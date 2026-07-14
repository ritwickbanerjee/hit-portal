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

// GET: Fetch a single routine
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const routine = await Routine.findById(id);
        if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
        return NextResponse.json(routine);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update a routine
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const { name, description, grid, faculties, mappingRules, lockedCells, codeResponsibilities } = body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (grid !== undefined) updateData.grid = grid;
        if (faculties !== undefined) updateData.faculties = faculties;
        if (mappingRules !== undefined) updateData.mappingRules = mappingRules;
        if (lockedCells !== undefined) updateData.lockedCells = lockedCells;
        if (codeResponsibilities !== undefined) updateData.codeResponsibilities = codeResponsibilities;

        const routine = await Routine.findByIdAndUpdate(id, updateData, { new: true });
        if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
        return NextResponse.json(routine);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Archive a routine
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const routine = await Routine.findByIdAndDelete(id);
        if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
        return NextResponse.json({ message: 'Routine deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
