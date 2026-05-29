import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const facultyName = searchParams.get('facultyName');
        const course = searchParams.get('course');
        const department = searchParams.get('department');
        const year = searchParams.get('year');

        if (!facultyName) {
            return NextResponse.json({ error: 'Faculty name is required' }, { status: 400 });
        }

        // Find config for this faculty (lean = skip Mongoose hydration)
        const config = await MockTestConfig.findOne({ facultyName }).lean() as any;

        if (!config || !config.topics) {
            return NextResponse.json([]);
        }

        // Filter topics that are:
        // 1. Enabled
        // 2. Have deployments
        // 3. Have at least one deployment matching student's course/dept/year
        const enabledTopics = config.topics
            .filter((t: any) => {
                if (!t.enabled || !t.deployments || t.deployments.length === 0) {
                    return false;
                }

                // Check if any deployment matches this student
                const hasMatchingDeployment = t.deployments.some((dep: any) =>
                    dep.department === department &&
                    dep.year === year &&
                    dep.course === course
                );

                return hasMatchingDeployment;
            })
            .map((t: any) => t.topic)
            .sort();

        const res = NextResponse.json(enabledTopics);
        // Topics change rarely â€” cache per-user for 2 minutes
        res.headers.set('Cache-Control', 'private, max-age=120');
        return res;
    } catch (error) {
        console.error('[MOCK TEST TOPICS] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
