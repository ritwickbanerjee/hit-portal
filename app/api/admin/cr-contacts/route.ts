import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CRContact from '@/models/CRContact';

// GET: Fetch all CR contacts (Global)
export async function GET(req: NextRequest) {
    try {
        await connectDB();
        
        // Fetch all CR Contacts for global visibility, regardless of faculty
        const contacts = await CRContact.find().sort({ updatedAt: -1 });
        return NextResponse.json({ contacts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Upsert a CR contact (Global based on Dept/Year/Course)
export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const { department, year, courseCode, crPhone, crName } = await req.json();

        if (!department || !year || !courseCode || !crPhone) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const facultyEmail = req.headers.get('X-User-Email');

        const contact = await CRContact.findOneAndUpdate(
            { department, year, courseCode },
            { crPhone, crName: crName || '', facultyName: facultyEmail, updatedAt: new Date() },
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
