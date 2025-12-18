import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsFromFile, getGlobalUsage, incrementUsage } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const userEmail = req.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json(
                { error: 'User email is required' },
                { status: 401 }
            );
        }

        // Global Passive Tracking - No Blocking Checks
        // We simply proceed to extraction

        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPG, DOCX` },
                { status: 400 }
            );
        }

        // Validate file size based on type (per-user limits, API limits divided by 8)
        let maxSize: number;
        let sizeLabel: string;

        if (file.type === 'application/pdf') {
            maxSize = 6.25 * 1024 * 1024; // 6.25MB per user
            sizeLabel = '6.25MB';
        } else if (file.type.startsWith('image/')) {
            maxSize = 2.5 * 1024 * 1024; // 2.5MB per user
            sizeLabel = '2.5MB';
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            maxSize = 10 * 1024 * 1024; // 10MB per user
            sizeLabel = '10MB';
        } else {
            maxSize = 5 * 1024 * 1024; // 5MB fallback
            sizeLabel = '5MB';
        }

        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File too large. ${file.type.split('/')[1].toUpperCase()} files must be under ${sizeLabel} per user. Consider compressing or splitting your file.` },
                { status: 413 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Extract questions with progress tracking
        const questions = await extractQuestionsFromFile(
            buffer,
            file.type,
            file.name
        );

        // Increment usage counter (Global)
        await incrementUsage(10000);

        // Get updated global stats
        const globalStats = await getGlobalUsage();

        return NextResponse.json({
            success: true,
            questions,
            usage: {
                used: globalStats.usage,
                limit: 1500, // Visual Reference Only
                remaining: 1500 - globalStats.usage, // Visual Reference Only
                resetIn: globalStats.resetIn
            }
        });



    } catch (error: any) {
        console.error('Extract API error:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to extract questions',
                details: error.toString()
            },
            { status: 500 }
        );
    }
}

// GET endpoint to check current usage
export async function GET(req: NextRequest) {
    try {
        const globalStats = await getGlobalUsage();

        return NextResponse.json({
            usage: globalStats.usage,
            limit: 1500, // Visual Reference
            remaining: 1500 - globalStats.usage, // Visual Reference
            resetIn: globalStats.resetIn,
            allowed: true // Always allowed (Passive Tracking)
        });

    } catch (error: any) {
        console.error('Usage check error:', error);

        return NextResponse.json(
            { error: error.message || 'Failed to check usage' },
            { status: 500 }
        );
    }
}
