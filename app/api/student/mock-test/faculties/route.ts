import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Attendance from '@/models/Attendance';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const course = searchParams.get('course');
        const department = searchParams.get('department');
        const year = searchParams.get('year');

        console.log('[MOCK TEST] Fetching faculties for:', { course, department, year });

        if (!course || !department || !year) {
            return NextResponse.json({ error: 'Course, department, and year are required' }, { status: 400 });
        }

        // Use the exact same logic as attendance system:
        // Find all attendance records for this dept/year/course
        // and extract unique faculty names
        const attendanceRecords = await Attendance.find({
            department: department,
            year: year,
            course_code: course
        }).select('teacherName');

        console.log(`[MOCK TEST] Attendance records found: ${attendanceRecords.length}`);

        // Extract unique faculty names
        const facultyNames = [...new Set(
            attendanceRecords
                .filter(r => r.teacherName)
                .map(r => r.teacherName)
        )].sort();

        console.log('[MOCK TEST] Found faculties:', facultyNames);

        return NextResponse.json(facultyNames);
    } catch (error) {
        console.error('Fetch Faculties Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
