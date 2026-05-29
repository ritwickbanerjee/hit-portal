import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);

        const course = searchParams.get('course');
        const department = searchParams.get('department');
        const year = searchParams.get('year');

        // Get all mock test configurations (lean = no Mongoose hydration overhead)
        const configs = await MockTestConfig.find({}).lean() as any[];

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

        const res = NextResponse.json(facultyNames);
        // Faculty configs change rarely â€” cache per-user for 2 minutes
        res.headers.set('Cache-Control', 'private, max-age=120');
        return res;
    } catch (error) {
        console.error('[MOCK TEST FACULTIES] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
