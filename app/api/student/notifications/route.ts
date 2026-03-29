import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import Student from '@/models/Student';
import mongoose from 'mongoose';

export async function GET(req: Request) {
    try {
        await connectDB();
        // SECURE: Read from headers
        const studentId = req.headers.get('x-user-id');

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Multi-ID Support: Find all IDs for this student
        const currentStudent = await Student.findById(studentId);
        let allStudentIds = [studentId];
        if (currentStudent) {
            const allDocs = await Student.find({ roll: currentStudent.roll });
            allStudentIds = allDocs.map(d => d._id.toString());
        }

        const notifications = await Notification.find({ studentId: { $in: allStudentIds } })
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await Notification.countDocuments({ studentId: { $in: allStudentIds }, isRead: false });

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Fetch Notifications Error:', error);
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
