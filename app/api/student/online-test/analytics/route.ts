import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StudentTestAttempt from '@/models/StudentTestAttempt';
import OnlineTest from '@/models/OnlineTest';
import Student from '@/models/Student';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-this-in-prod';
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { payload } = await jwtVerify(token, key);
        const roll = payload.roll as string;

        if (!roll) {
            return NextResponse.json({ error: 'User roll not found' }, { status: 400 });
        }

        await connectDB();

        // 1. Get student's courses from MongoDB
        const studentDocs = await Student.find({ roll }).lean() as any[];
        const studentCourses = studentDocs.map(doc => doc.course_code).filter(Boolean);

        if (studentCourses.length === 0) {
            return NextResponse.json({ totalTests: 0, averageScore: 0, batches: [] });
        }

        // 1b. Determine selected batch (default to first course if not specified)
        const requestedBatch = req.nextUrl.searchParams.get('course');
        const selectedBatch = requestedBatch && studentCourses.includes(requestedBatch)
            ? requestedBatch
            : studentCourses[0]; 
        
        // 2. Fetch all deployed tests for the selected course
        const allTests = await OnlineTest.find({
            status: 'deployed',
            'deployment.course': selectedBatch
        }).select('_id title totalMarks deployment config');

        // 3. Fetch all attempts by this student for this course
        // Note: in this project studentPhone stores roll
        const attempts = await StudentTestAttempt.find({
            studentPhone: roll
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
        // Filter tests that should be visible in analytics
        const visibleTestIds = allTests.filter(t => {
            const showResults = t.config?.showResults ?? true;
            const showImmediately = t.config?.showResultsImmediately ?? true;
            const end = t.deployment?.endTime ? new Date(t.deployment.endTime) : null;

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
                    originalPercentage: attempt.percentage || 0
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
        let batchHighestAverage = 0;
        let batchRank = 0;
        let totalBatchStudents = 0;
        let leaderboard: any[] = [];

        // All students in this course
        const studentsInCourse = await Student.find({ course_code: selectedBatch }).select('roll name').lean();
        const batchRolls = studentsInCourse.map(s => s.roll);
        totalBatchStudents = studentsInCourse.length;

        if (batchRolls.length > 0 && visibleTestIds.length > 0) {
            const allBatchAttempts = await StudentTestAttempt.find({
                studentPhone: { $in: batchRolls },
                testId: { $in: visibleTestIds },
                status: 'completed'
            });

            const studentAttemptsMap = new Map<string, { percentage: number; timeSpent: number }[]>();
            allBatchAttempts.forEach((a: any) => {
                const sRoll = a.studentPhone;
                if (!studentAttemptsMap.has(sRoll)) {
                    studentAttemptsMap.set(sRoll, []);
                }
                studentAttemptsMap.get(sRoll)!.push({
                    percentage: a.percentage || 0,
                    timeSpent: a.timeSpent || 0
                });
            });

            const rollToName = new Map<string, string>();
            studentsInCourse.forEach(s => rollToName.set(s.roll, s.name));

            const rankings: any[] = [];
            studentAttemptsMap.forEach((attemptsData, sRoll) => {
                const avg = Math.round(attemptsData.reduce((acc, curr) => acc + curr.percentage, 0) / attemptsData.length);
                const avgTime = Math.round(attemptsData.reduce((acc, curr) => acc + curr.timeSpent, 0) / attemptsData.length);
                rankings.push({
                    name: rollToName.get(sRoll) || 'Unknown',
                    roll: sRoll,
                    average: avg,
                    avgTimeSpent: avgTime,
                    testsAttempted: attemptsData.length
                });
            });

            rankings.sort((a, b) => {
                if (b.average !== a.average) return b.average - a.average;
                return a.avgTimeSpent - b.avgTimeSpent;
            });

            let currentRank = 1;
            rankings.forEach((r, i, arr) => {
                if (i > 0) {
                    const prev = arr[i - 1];
                    if (r.average < prev.average || r.avgTimeSpent > prev.avgTimeSpent) {
                        currentRank = i + 1;
                    }
                }
                r.rank = currentRank;
            });

            batchHighestAverage = rankings.length > 0 ? rankings[0].average : 0;
            const myRankObj = rankings.find(r => r.roll === roll);
            batchRank = myRankObj ? myRankObj.rank! : rankings.length + 1;

            leaderboard = rankings.slice(0, 5).map(r => ({
                rank: r.rank!,
                name: r.name,
                roll: r.roll === roll ? r.roll : '***',
                average: r.average,
                testsAttempted: r.testsAttempted
            }));
        }

        // 6. Per-test comparison
        let testComparison: any[] = [];
        if (validAttempts.length > 0 && batchRolls.length > 0) {
            const completedTestObjectIds = validAttempts.map(a => new mongoose.Types.ObjectId(a.testId));
            const highestPerTest = await StudentTestAttempt.aggregate([
                {
                    $match: {
                        studentPhone: { $in: batchRolls },
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

            testComparison = validAttempts.map(a => ({
                testId: a.testId,
                title: a.title,
                studentScore: a.percentage,
                highestScore: highestMap.get(a.testId) || a.percentage
            }));
        }

        return NextResponse.json({
            totalTests,
            averageScore,
            recentScore,
            highestScore,
            missed,
            pending,
            trend,
            history: completedAttempts.slice(-10),
            testComparison,
            batchHighestAverage,
            batchRank,
            totalBatchStudents,
            leaderboard,
            batches: studentCourses,
            selectedBatch: selectedBatch
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
