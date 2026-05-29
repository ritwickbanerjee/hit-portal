import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import Student from '@/models/Student';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        // SECURE: Read from headers
        const studentId = req.headers.get('x-user-id');

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Multi-ID Support: Find all IDs for this student (lean() skips hydration â€” faster)
        const currentStudent = await Student.findById(studentId).lean() as any;
        let allStudentIds: string[] = [studentId];
        if (currentStudent) {
            const allDocs = await Student.find({ roll: currentStudent.roll }).lean() as any[];
            allStudentIds = allDocs.map((d: any) => d._id.toString());
        }

        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ studentId: { $in: allStudentIds } })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean(),
            Notification.countDocuments({ studentId: { $in: allStudentIds }, isRead: false }),
        ]);

        const res = NextResponse.json({ notifications, unreadCount });
        // Cache per-user for 30 s â€” reduces DB hits on rapid page switches
        res.headers.set('Cache-Control', 'private, max-age=30');
        return res;
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}


export async function PATCH(req: Request) {
    try {
        await connectDB();
        const { notificationId } = await req.json();

        if (!notificationId) {
            return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
        }

        await Notification.findByIdAndUpdate(notificationId, { isRead: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        // SECURE: Read from headers
        const studentId = req.headers.get('x-user-id');

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Multi-ID Support: Find all IDs for this student
        const currentStudent = await Student.findById(studentId);
        let allStudentIds = [studentId];
        if (currentStudent) {
            const allDocs = await Student.find({ roll: currentStudent.roll });
            allStudentIds = allDocs.map(d => d._id.toString());
        }

        // Delete (or mark as read?) - User said "Clear All", usually implies delete or mark all read.
        // Let's assume Delete based on "Clear" wording, or Mark All Read?
        // Typically "Clear" in notifications list means remove them.
        // Let's do deleteMany.
        await Notification.deleteMany({ studentId: { $in: allStudentIds } });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
