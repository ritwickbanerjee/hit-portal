import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Resource from '@/models/Resource';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const department = searchParams.get('department');
        const year = searchParams.get('year');
        const course_code = searchParams.get('course_code');



        if (!department || !year) {
            return NextResponse.json({ error: 'Department and Year are required' }, { status: 400 });
        }

        const courseCodes = course_code ? course_code.split(',') : [];

        // Query resources - matching department, year, and optionally course
        const query: any = {
            $or: [
                { targetDepartments: department },
                { targetDepartments: { $in: [department] } }
            ],
            targetYear: year,
            ...(courseCodes.length > 0 ? { targetCourse: { $in: courseCodes } } : {})
        };

        let resources = await Resource.find(query).sort({ createdAt: -1 });


        // If no results, try getting all resources (fallback)  
        if (resources.length === 0) {
            resources = await Resource.find({}).sort({ createdAt: -1 });

        }

        return NextResponse.json(resources);
    } catch (error) {
        console.error('Fetch Resources Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
