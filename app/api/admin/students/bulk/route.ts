import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Student from '@/models/Student';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        await connectDB();
        const { students } = await req.json();

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'No students provided' }, { status: 400 });
        }

        const results = {
            added: 0,
            failed: 0,
            errors: [] as string[],
        };

        for (const s of students) {
            try {
                if (!s.email || !s.roll || !s.course_code) {
                    results.failed++;
                    results.errors.push(`Missing email, roll, or course_code for a student`);
                    continue;
                }

                // EXACT MATCH: Same Roll AND Same Course
                const existing = await Student.findOne({
                    roll: s.roll,
                    course_code: s.course_code
                });

                if (existing) {
                    // UPDATE: Update email, name, dept, year for this specific course enrollment
                    existing.email = s.email;
                    existing.name = s.name;
                    existing.department = s.department;
                    existing.year = s.year;
                    // Note: course_code remains same as it's part of the query

                    if (s.guardian_email) existing.guardian_email = s.guardian_email;

                    await existing.save();
                    results.added++; // Count as handled/updated
                } else {
                    // CREATE: New document for this course enrollment
                    const hashedPassword = await bcrypt.hash(s.roll, 10);
                    await Student.create({
                        ...s,
                        // course_code is already string in 's'
                        password: hashedPassword,
                    });
                    results.added++;
                }
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Error for ${s.roll} (${s.course_code}): ${err.message}`);
            }
        }

        return NextResponse.json({ message: 'Bulk upload complete', results });
    } catch (error: any) {
        console.error('Bulk upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
