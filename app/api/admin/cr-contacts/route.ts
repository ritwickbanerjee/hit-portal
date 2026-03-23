import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CRContact from '@/models/CRContact';

// GET: Fetch all CR contacts for a faculty
export async function GET(req: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const facultyName = searchParams.get('facultyName');

        if (!facultyName) {
            return NextResponse.json({ error: 'Faculty name is required' }, { status: 400 });
        }

        const contacts = await CRContact.find({ facultyName });
        return NextResponse.json({ contacts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Upsert a CR contact
export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { facultyName, department, year, courseCode, crPhone, crName } = await req.json();

        if (!facultyName || !department || !year || !courseCode || !crPhone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const contact = await CRContact.findOneAndUpdate(
            { facultyName, department, year, courseCode },
            { crPhone, crName: crName || '', updatedAt: new Date() },
            { upsert: true, new: true }
        );

        return NextResponse.json({ contact });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove a CR contact
export async function DELETE(req: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
        }

        await CRContact.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
