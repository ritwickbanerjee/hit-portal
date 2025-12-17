import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import MockTestConfig from '@/models/MockTestConfig';

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

        console.log('[MOCK TEST TOPICS] Fetching topics for faculty:', facultyName);
        console.log('[MOCK TEST TOPICS] Student:', { course, department, year });

        // Find config for this faculty
        const config = await MockTestConfig.findOne({ facultyName });

        if (!config || !config.topics) {
            console.log('[MOCK TEST TOPICS] No config found for faculty');
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

        console.log('[MOCK TEST TOPICS] Enabled topics for this student:', enabledTopics);

        return NextResponse.json(enabledTopics);
    } catch (error) {
        console.error('[MOCK TEST TOPICS] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
