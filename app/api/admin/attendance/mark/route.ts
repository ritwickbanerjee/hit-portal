import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { date, course, department, year, timeSlot, teacherName, teacherEmail, records } = await req.json();

        // Validate required fields
        if (!date || !course || !records || !department || !year) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Separate present and absent students
        const presentStudentIds = records
            .filter((r: any) => r.status === 'Present')
            .map((r: any) => r.studentId);

        const absentStudentIds = records
            .filter((r: any) => r.status === 'Absent')
            .map((r: any) => r.studentId);

        // Create Attendance Record
        // We might want to upsert (update if exists for same date/course/time) or just create new.
        // For simplicity, let's create new.

        await Attendance.create({
            date,
            teacherName: teacherName || 'Allocated Faculty', // You might want to pass this from frontend or auth session
            teacherEmail: teacherEmail || 'faculty@institute.edu',
            department,
            year,
            course_code: course,
            timeSlot: timeSlot || '09:00 AM - 10:00 AM', // Default or passed
            presentStudentIds,
            absentStudentIds
        });

        // OPTIONAL: Update Student aggregate stats immediately? 
        // We can do it here or let the student dashboard calculate on fly (which we did).
        // Let's rely on on-fly calculation for consistency.

        console.log(`Saved attendance for ${course} on ${date}`);

        return NextResponse.json({ message: 'Attendance marked successfully' });
    } catch (error: any) {
        console.error('Mark Attendance Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
