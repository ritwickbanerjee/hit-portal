import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import AttendanceAdjustment from '@/models/AttendanceAdjustment';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const studentId = req.headers.get('x-user-id'); // SECURE: Get ID from token (middleware) NOT query param

        if (!studentId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return NextResponse.json({ error: 'Invalid Student ID' }, { status: 400 });
        }

        // Get student info to know their roll and department
        const student = await Student.findById(studentId);
        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // FIND ALL IDs for this student (across all courses) - EXCLUDE DISABLED
        const allStudentDocs = await Student.find({ roll: student.roll, loginDisabled: { $ne: true } });
        const allStudentIds = allStudentDocs.map(s => s._id);
        const allCourseCodes = allStudentDocs.map(s => s.course_code);

        // Find records where student is marked present or absent (using ANY of their IDs)
        const records = await Attendance.find({
            $or: [
                { presentStudentIds: { $in: allStudentIds } },
                { absentStudentIds: { $in: allStudentIds } }
            ]
        }).sort({ date: -1 });

        // Get ALL attendance records for these courses to detect mass bunks
        // Mass bunk = when presentStudentIds array is empty (no one attended)
        const allCourseRecords = await Attendance.find({
            course_code: { $in: allCourseCodes }, // use array of courses
            department: student.department,
            year: student.year
        });

        // Detect mass bunks (where no student was present AND this student was marked absent)
        // We only count mass bunks where the student was actually part of the class (marked absent)
        const massBunks = allCourseRecords.filter(r =>
            (!r.presentStudentIds || r.presentStudentIds.length === 0) &&
            r.absentStudentIds &&
            r.absentStudentIds.some((id: any) =>
                allStudentIds.some(sid => sid.toString() === id.toString())
            )
        );

        const massBunkDates = massBunks.map(r => ({
            date: r.date,
            timeSlot: r.timeSlot,
            teacherName: r.teacherName,
            course_code: r.course_code
        }));

        const processedRecords = records.map(record => {
            // Check if ANY of the student's IDs are in the present list
            // We use string comparison to be safe with ObjectId
            const isPresent = record.presentStudentIds.some((id: any) =>
                allStudentIds.some(sid => sid.toString() === id.toString())
            );

            return {
                ...record.toObject(),
                status: isPresent ? 'Present' : 'Absent'
            };
        });

        const adjustments: Record<string, { attended: number, total: number }> = {};
        allStudentDocs.forEach(s => {
            if (s.course_code) {
                adjustments[s.course_code] = {
                    attended: s.attended_adjustment || 0,
                    total: s.total_classes_adjustment || 0
                };
            }
        });

        // Fetch per-entry adjustment records for display
        const adjustmentEntries = await AttendanceAdjustment.find({
            studentRoll: student.roll
        }).sort({ createdAt: -1 });

        return NextResponse.json({
            records: processedRecords,
            massBunkCount: massBunks.length,
            massBunkDates,
            adjustments, // Now a dictionary: { "MTH101": { attended: 1, total: 0 }, ... }
            adjustmentEntries: adjustmentEntries.map(e => ({
                _id: e._id,
                facultyName: e.facultyName,
                facultyEmail: e.facultyEmail,
                courseCode: e.courseCode,
                date: e.date,
                delta: e.delta,
                reason: e.reason,
                createdAt: e.createdAt
            }))
        });
    } catch (error) {
        console.error('Fetch Attendance Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
