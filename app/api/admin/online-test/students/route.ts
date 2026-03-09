import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BatchStudent from '@/models/BatchStudent';

// POST - Get students from MongoDB based on selected batches
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { batches } = body;

        if (!batches || !Array.isArray(batches)) {
            return NextResponse.json({ error: 'Batches must be an array' }, { status: 400 });
        }

        await dbConnect();

        // Query BatchStudent collection directly
        const students = await BatchStudent.find({
            courses: { $in: batches }
        }).select('phoneNumber name courses').lean();

        // Map to expected format, picking first matching batch as the primary
        const result = (students as any[]).map(s => {
            const matchingBatch = s.courses?.find((c: string) => batches.includes(c)) || s.courses?.[0] || '';
            return {
                phoneNumber: s.phoneNumber,
                studentName: s.name || 'Unknown',
                batchName: matchingBatch
            };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error in students API:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch students' }, { status: 500 });
    }
}
