import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Room from '@/models/Room';

export async function GET() {
    try {
        await connectDB();
        const rooms = await Room.find({}).sort({ roomNo: 1 }).lean();
        return NextResponse.json(rooms);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const body = await req.json();
        if (!body.roomNo) return NextResponse.json({ error: 'roomNo is required' }, { status: 400 });

        // Bulk sync: array of rooms (from routine sync)
        if (Array.isArray(body.rooms)) {
            const ops = body.rooms.map((r: any) => ({
                updateOne: {
                    filter: { roomNo: r.roomNo.trim().toUpperCase() },
                    update: { $setOnInsert: { label: '', building: '', capacity: 0, isActive: true, source: 'routine', addedBy: 'sync' } },
                    upsert: true,
                }
            }));
            await Room.bulkWrite(ops);
            return NextResponse.json({ success: true, count: ops.length });
        }

        // Single room upsert
        const room = await Room.findOneAndUpdate(
            { roomNo: body.roomNo.trim().toUpperCase() },
            {
                $set: {
                    label:    body.label    || '',
                    building: body.building || '',
                    capacity: body.capacity || 0,
                    isActive: body.isActive !== undefined ? body.isActive : true,
                    source:   body.source   || 'manual',
                    addedBy:  body.addedBy  || '',
                }
            },
            { upsert: true, new: true }
        );
        return NextResponse.json(room);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await connectDB();
        const { roomNo, isActive } = await req.json();
        const room = await Room.findOneAndUpdate({ roomNo }, { $set: { isActive } }, { new: true });
        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        return NextResponse.json(room);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const roomNo = searchParams.get('roomNo');
        if (!roomNo) return NextResponse.json({ error: 'roomNo required' }, { status: 400 });
        await Room.deleteOne({ roomNo: roomNo.toUpperCase() });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
