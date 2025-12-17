import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);

        const course = searchParams.get('course');
        const department = searchParams.get('department');
        const year = searchParams.get('year');

        console.log('[MOCK TEST FACULTIES] Student:', { course, department, year });

        // Get all mock test configurations
        const configs = await MockTestConfig.find({});
        console.log('[MOCK TEST FACULTIES] Found', configs.length, 'faculty configs');

        // Find faculties who have topics deployed to this student
        const facultiesWithDeployments = new Set<string>();

        for (const config of configs) {
            const hasMatchingDeployment = config.topics?.some((topicConfig: any) =>
                topicConfig.enabled &&
                topicConfig.deployments?.some((dep: any) =>
                    dep.department === department &&
                    dep.year === year &&
                    dep.course === course
                )
            );

            if (hasMatchingDeployment) {
                facultiesWithDeployments.add(config.facultyName);
            }
        }

        const facultyNames = Array.from(facultiesWithDeployments).sort();
        console.log('[MOCK TEST FACULTIES] Faculties with deployments:', facultyNames);

        return NextResponse.json(facultyNames);
    } catch (error) {
        console.error('[MOCK TEST FACULTIES] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
