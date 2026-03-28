import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import OnlineTest from '@/models/OnlineTest';
import BatchStudent from '@/models/BatchStudent';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { payload } = await jwtVerify(token, key);
        const phoneNumber = (payload.phoneNumber || payload.userId) as string;

        if (!phoneNumber) {
            return NextResponse.json({ error: 'User identifier not found' }, { status: 400 });
        }

        await connectDB();

        // 1. Get student's batches from MongoDB
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const dbStudent = await BatchStudent.findOne({ phoneNumber: cleanPhone }).lean() as any;
        const studentCourses = dbStudent?.courses || (payload.courses as string[]) || [];

        // 1b. Determine selected batch (default to ALL batches if not specified)
        const requestedBatch = req.nextUrl.searchParams.get('batch');
        const selectedBatch = requestedBatch && studentCourses.includes(requestedBatch)
            ? requestedBatch
            : null; // null = all batches
        const batchFilter = selectedBatch ? [selectedBatch] : studentCourses;

        // 2. Fetch all deployed tests for the selected batch
        const allTests = await OnlineTest.find({
            status: 'deployed',
            'deployment.batches': { $in: batchFilter }
        }).select('_id title totalMarks deployment config');

        // 3. Fetch all attempts by this student
        const attempts = await StudentTestAttempt.find({
            studentPhone: phoneNumber
        }).sort({ submittedAt: -1 });

        const attemptMap = new Map();
        attempts.forEach(a => attemptMap.set(a.testId.toString(), a));

        // 4. Calculate this student's stats
        let completedAttempts: any[] = [];
        let totalScore = 0;
        let highestScore = 0;
        const now = new Date();
        let missed = 0;
        let pending = 0;

        const testIds = allTests.map(t => t._id.toString());
        // Filter tests that should be visible in analytics (exclude deferred tests still pending OR properly hidden)
        const visibleTestIds = allTests.filter(t => {
            const showResults = t.config?.showResults ?? true;
            const showImmediately = t.config?.showResultsImmediately ?? true;
            const end = t.deployment?.endTime ? new Date(t.deployment.endTime) : null;

            // Visible if: Global Show is TRUE AND (Immediate OR Deadline Passed)
            if (!showResults) return false;
            return showImmediately || (end && now >= end);
        }).map(t => t._id.toString());

        for (const test of allTests) {
            const testId = test._id.toString();
            const attempt = attemptMap.get(testId);
            const endTime = test.deployment?.endTime ? new Date(test.deployment.endTime) : null;
            const startTime = test.deployment?.startTime ? new Date(test.deployment.startTime) : null;

            if (attempt?.status === 'completed') {
                const showResults = test.config?.showResults ?? true;
                const showResultsImmediately = test.config?.showResultsImmediately ?? true;

                // Pending if: Global Show is FALSE OR (Deferred AND Before Deadline)
                const isDeferred = !showResultsImmediately && (!endTime || now < endTime);
                const resultsPending = !showResults || isDeferred;

                completedAttempts.push({
                    testId,
                    title: test.title,
                    percentage: resultsPending ? null : Math.round(attempt.percentage || 0),
                    score: resultsPending ? null : (attempt.score || 0),
                    totalMarks: test.totalMarks || 0,
                    date: attempt.submittedAt,
                    resultsPending,
                    originalPercentage: attempt.percentage || 0 // Keep internal for sorting if needed, but safe to ignore for now as we sort by date
                });

                if (!resultsPending) {
                    totalScore += (attempt.percentage || 0);
                    if ((attempt.percentage || 0) > highestScore) highestScore = Math.round(attempt.percentage || 0);
                }
            } else {
                if (endTime && now > endTime) {
                    missed++;
                } else if (
                    (!endTime || now <= endTime) &&
                    (!startTime || now >= startTime)
                ) {
                    pending++;
                }
            }
        }

        completedAttempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Filter valid attempts for statistics
        const validAttempts = completedAttempts.filter(a => !a.resultsPending);

        const totalTests = validAttempts.length;
        const averageScore = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
        const recentScore = validAttempts.length > 0 ? validAttempts[validAttempts.length - 1].percentage : 0;

        let trend = 'neutral';
        if (validAttempts.length >= 2) {
            const current = validAttempts[validAttempts.length - 1].percentage;
            const prev = validAttempts[validAttempts.length - 2].percentage;
            if (current > prev) trend = 'up';
            else if (current < prev) trend = 'down';
        }

        // 5. BATCH COMPARISON & LEADERBOARD
        // Get all students from same batches
        let batchHighestAverage = 0;
        let batchRank = 0;
        let totalBatchStudents = 0;
        let leaderboard: { name: string; phone: string; average: number; testsAttempted: number }[] = [];

        // Fetch batch students from MongoDB
        const batchStudentDocs = batchFilter.length > 0
            ? await BatchStudent.find({ courses: { $in: batchFilter } }).select('phoneNumber name').lean() as any[]
            : [];
        const batchStudents = batchStudentDocs.map((s: any) => ({ phone: s.phoneNumber, name: s.name || 'Unknown' }));
        const batchPhones = batchStudents.map(s => s.phone);

        if (studentCourses.length > 0 && testIds.length > 0) {
            // Fetch all completed attempts for ALL batch students for the VISIBLE tests only
            const allBatchAttempts = await StudentTestAttempt.find({
                studentPhone: { $in: batchPhones },
                testId: { $in: visibleTestIds },
                status: 'completed'
            });

            // Group attempts by student phone
            const studentAttemptsMap = new Map<string, number[]>();
            allBatchAttempts.forEach((a: any) => {
                const phone = a.studentPhone;
                if (!studentAttemptsMap.has(phone)) {
                    studentAttemptsMap.set(phone, []);
                }
                studentAttemptsMap.get(phone)!.push(a.percentage || 0);
            });

            // Build leaderboard: compute average for each student
            const phoneToName = new Map<string, string>();
            batchStudents.forEach(s => phoneToName.set(s.phone, s.name));

            const rankings: { name: string; phone: string; average: number; testsAttempted: number }[] = [];

            studentAttemptsMap.forEach((percentages, phone) => {
                const avg = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
                rankings.push({
                    name: phoneToName.get(phone) || 'Unknown',
                    phone,
                    average: avg,
                    testsAttempted: percentages.length
                });
            });

            // Sort by average descending
            rankings.sort((a, b) => b.average - a.average);

            // Find rank and highest average
            batchHighestAverage = rankings.length > 0 ? rankings[0].average : 0;
            totalBatchStudents = batchStudents.length;

            const myRankIndex = rankings.findIndex(r => r.phone === phoneNumber.replace(/\D/g, ''));
            batchRank = myRankIndex >= 0 ? myRankIndex + 1 : rankings.length + 1;

            // Send top 10 for leaderboard display (mask phone numbers)
            leaderboard = rankings.slice(0, 10).map(r => ({
                name: r.name,
                phone: r.phone === phoneNumber.replace(/\D/g, '') ? r.phone : '***',
                average: r.average,
                testsAttempted: r.testsAttempted
            }));
        }

        // 6. Per-test comparison: student score vs highest score in batch for that test
        let testComparison: { testId: string; title: string; studentScore: number; highestScore: number }[] = [];

        if (validAttempts.length > 0 && batchPhones.length > 0) {
            const completedTestObjectIds = validAttempts.map(a => new mongoose.Types.ObjectId(a.testId));

            const highestPerTest = await StudentTestAttempt.aggregate([
                {
                    $match: {
                        studentPhone: { $in: batchPhones },
                        testId: { $in: completedTestObjectIds },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: '$testId',
                        maxPercentage: { $max: '$percentage' }
                    }
                }
            ]);

            const highestMap = new Map<string, number>();
            highestPerTest.forEach((h: any) => highestMap.set(h._id.toString(), Math.round(h.maxPercentage || 0)));

            // Build comparison for ALL completed tests
            testComparison = validAttempts.map(a => ({
                testId: a.testId,
                title: a.title,
                studentScore: a.percentage,
                highestScore: highestMap.get(a.testId) || a.percentage
            }));
        }

        const responseData = {
            totalTests,
            averageScore,
            recentScore,
            highestScore,
            missed,
            pending,
            trend,
            history: completedAttempts.slice(-10), // Last 10, chronological
            testComparison, // Per-test: student vs highest in batch
            batchHighestAverage,
            batchRank,
            totalBatchStudents,
            leaderboard,
            batches: studentCourses, // All batches for tab rendering
            selectedBatch: selectedBatch || '', // Currently selected batch
        };

        return NextResponse.json(responseData, {
            headers: {
                // Cache at CDN for 5 minutes, serve stale for up to 1 hour while revalidating
                // This massively cuts Netlify function invocations for this heavy query
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
            },
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
