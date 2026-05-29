import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { ids, disabled } = await req.json();

        if (!Array.isArray(ids) || ids.length === 0 || typeof disabled !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Fetch students to determine new course codes
        const students = await Student.find({ _id: { $in: ids } });

        const updates = students.map(student => {
            let newCourseCode = student.course_code;
            if (disabled) {
                if (!newCourseCode.startsWith('DISABLED_')) {
                    newCourseCode = `DISABLED_${newCourseCode}`;
                }
            } else {
                if (newCourseCode.startsWith('DISABLED_')) {
                    newCourseCode = newCourseCode.replace('DISABLED_', '');
                }
            }

            return {
                updateOne: {
                    filter: { _id: student._id },
                    update: {
                        loginDisabled: disabled,
                        course_code: newCourseCode
                    }
                }
            };
        });

        if (updates.length > 0) {
            await Student.bulkWrite(updates);
        }

        return NextResponse.json({
            message: `Successfully updated ${updates.length} students`,
            modifiedCount: updates.length
        });

    } catch (error) {
        console.error('Bulk Status Update Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
