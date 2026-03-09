import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Folder from '@/models/Folder';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all folders with type 'test' for this user
        const folders = await Folder.find({
            createdBy: userEmail,
            type: 'test'
        }).sort({ name: 1 });

        return NextResponse.json(folders);
    } catch (error) {
        console.error('Error fetching test folders:', error);
        return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name } = await req.json();

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const folder = await Folder.create({
            name: name.trim(),
            createdBy: userEmail,
            type: 'test'
        });

        return NextResponse.json(folder, { status: 201 });
    } catch (error) {
        console.error('Error creating folder:', error);
        return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        await dbConnect();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, name } = await req.json();

        if (!id || !name || !name.trim()) {
            return NextResponse.json({ error: 'Folder ID and name are required' }, { status: 400 });
        }

        const folder = await Folder.findOneAndUpdate(
            { _id: id, createdBy: userEmail, type: 'test' },
            { name: name.trim() },
            { new: true }
        );

        if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        return NextResponse.json(folder);
    } catch (error) {
        console.error('Error updating folder:', error);
        return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await dbConnect();
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
        }

        const folder = await Folder.findOneAndDelete({
            _id: id,
            createdBy: userEmail,
            type: 'test'
        });

        if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }
}
