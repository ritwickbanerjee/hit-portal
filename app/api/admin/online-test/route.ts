import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import OnlineTest from '@/models/OnlineTest';

// GET - List all tests
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const folderId = searchParams.get('folderId');
        const userEmail = request.headers.get('X-User-Email');

        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const query: any = { createdBy: userEmail };
        if (status) {
            const statusArray = status.split(',');
            if (statusArray.length > 1) {
                query.status = { $in: statusArray };
            } else {
                query.status = status;
            }
        }
        // Apply folder filter only when explicitly requested
        if (searchParams.has('folderId')) {
            const folderIdParam = searchParams.get('folderId');
            query.folderId = folderIdParam === 'null' ? null : folderIdParam;
        }

        console.log('🔍 GET /api/admin/online-test - Query:', JSON.stringify(query));

        const tests = await OnlineTest.find(query).sort({ createdAt: -1 });

        console.log('📦 Found', tests.length, 'tests');

        return NextResponse.json(tests);
    } catch (error: any) {
        console.error('Error fetching online tests:', error);
        return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 });
    }
}

// POST - Create new test
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, description, questions, config, deployment, folderId } = body;

        // Validation
        if (!title || !questions || questions.length === 0) {
            return NextResponse.json({ error: 'Title and questions are required' }, { status: 400 });
        }

        // Create test
        const test = new OnlineTest({
            title,
            description,
            questions,
            config: config || {},
            deployment: deployment || {},
            createdBy: userEmail,
            folderId: folderId || null,
            status: 'draft'
        });

        await test.save();
        return NextResponse.json(test, { status: 201 });
    } catch (error: any) {
        console.error('Error creating test:', error);
        return NextResponse.json({ error: 'Failed to create test' }, { status: 500 });
    }
}

// PUT - Update test
export async function PUT(request: NextRequest) {
    try {
        await connectDB();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, graceMarksForModified, ...updates } = body;

        console.log('🔧 PUT request - ID:', id, 'Updates:', Object.keys(updates));

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test and check ownership
        const test = await OnlineTest.findOne({ _id: id, createdBy: userEmail });
        if (!test) {
            console.log('❌ Test not found or unauthorized');
            return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
        }

        console.log('📋 Current test status:', test.status, 'Current folderId:', test.folderId);

        // If deployed test, handle grace marks OR question updates (re-grading)
        if (test.status === 'deployed' && updates.questions) {
            const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;

            console.log('🔄 Re-grading all completed attempts for test:', id);
            const attempts = await StudentTestAttempt.find({ testId: id, status: 'completed' });

            const newQuestionsMap = new Map();
            updates.questions.forEach((q: any) => newQuestionsMap.set(q.id, q));

            for (const attempt of attempts) {
                let scoreChanged = false;
                let newScore = 0;

                if (attempt.questions && attempt.questions.length > 0) {
                    attempt.questions = attempt.questions.map((q: any) => {
                        const updatedQ = newQuestionsMap.get(q.id);
                        if (updatedQ) {
                            return { ...q, ...updatedQ, isGrace: updatedQ.isGrace };
                        }
                        return q;
                    });
                    attempt.markModified('questions');
                }

                attempt.answers = attempt.answers.map((ans: any) => {
                    const qDef = newQuestionsMap.get(ans.questionId);
                    if (!qDef) return ans; 

                    let isCorrect = false;
                    let marksAwarded = 0;

                    if (qDef.isGrace) {
                        isCorrect = true;
                        marksAwarded = qDef.marks || 1;
                        ans.isGraceAwarded = true;
                    } else {
                        ans.isGraceAwarded = false; 

                        if (qDef.type === 'mcq') {
                            const studentIdx = Array.isArray(ans.answer) ? ans.answer[0] : parseInt(ans.answer);
                            if (qDef.correctIndices?.includes(studentIdx)) {
                                isCorrect = true;
                                marksAwarded = qDef.marks || 1;
                            } else {
                                marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                            }
                        } else if (qDef.type === 'msq') {
                            const studentIndices = Array.isArray(ans.answer) ? ans.answer.map((i: any) => parseInt(i)) : [];
                            const correctSorted = [...(qDef.correctIndices || [])].sort();
                            const studentSorted = [...studentIndices].sort();

                            const isMatch = JSON.stringify(correctSorted) === JSON.stringify(studentSorted);
                            if (isMatch) {
                                isCorrect = true;
                                marksAwarded = qDef.marks || 1;
                            } else {
                                marksAwarded = -Math.abs(qDef.negativeMarks || 0);
                            }
                        } else if (qDef.type === 'fillblank') {
                            if (qDef.isNumberRange) {
                                const val = parseFloat(ans.answer);
                                if (!isNaN(val) && val >= qDef.numberRangeMin && val <= qDef.numberRangeMax) {
                                    isCorrect = true;
                                    marksAwarded = qDef.marks || 1;
                                }
                            } else {
                                const studentAns = (ans.answer || '').toString().trim();
                                const correctAns = (qDef.fillBlankAnswer || '').toString().trim();
                                if (qDef.caseSensitive) {
                                    if (studentAns === correctAns) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    }
                                } else {
                                    if (studentAns.toLowerCase() === correctAns.toLowerCase()) {
                                        isCorrect = true;
                                        marksAwarded = qDef.marks || 1;
                                    }
                                }
                            }
                        }
                    }

                    ans.isCorrect = isCorrect;
                    ans.marksAwarded = marksAwarded;
                    newScore += marksAwarded;

                    return ans;
                });

                attempt.graceMarks = body.graceMarks || 0;

                if (attempt.graceMarks > 0) {
                    attempt.graceReason = body.graceReason || 'Grace marks awarded';
                } else {
                    attempt.graceReason = '';
                }

                newScore += attempt.graceMarks;

                let currentTotalMarks = 0;
                if (attempt.questions && attempt.questions.length > 0) {
                    currentTotalMarks = attempt.questions.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);
                } else {
                    currentTotalMarks = updates.questions.reduce((sum: number, q: any) => sum + (q.marks || 0), 0);
                }

                if (currentTotalMarks === 0) currentTotalMarks = 1; 

                attempt.score = newScore;
                attempt.percentage = Math.round((newScore / currentTotalMarks) * 100);

                scoreChanged = true;
                if (scoreChanged) await attempt.save();
            }
        }

        // MERGE deployment updates instead of overwriting
        if (updates.deployment) {
            if (!test.deployment) test.deployment = {};
            Object.assign(test.deployment, updates.deployment);
            test.markModified('deployment');
            delete updates.deployment;
        }

        // Update test - allow remaining fields
        Object.assign(test, updates);
        await test.save();

        console.log('✅ Test updated! New folderId:', test.folderId);

        return NextResponse.json(test);
    } catch (error: any) {
        console.error('Error updating test:', error);
        return NextResponse.json({ error: 'Failed to update test' }, { status: 500 });
    }
}

// DELETE - Delete test
export async function DELETE(request: NextRequest) {
    try {
        await connectDB();

        const userEmail = request.headers.get('X-User-Email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Test ID is required' }, { status: 400 });
        }

        // Find test and check ownership
        const test = await OnlineTest.findOne({ _id: id, createdBy: userEmail });
        if (!test) {
            return NextResponse.json({ error: 'Test not found or unauthorized' }, { status: 404 });
        }

        // Delete associated student attempts first
        const StudentTestAttempt = (await import('@/models/StudentTestAttempt')).default;
        const deleteResult = await StudentTestAttempt.deleteMany({ testId: id });
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} attempts for test ${id}`);

        await OnlineTest.deleteOne({ _id: id });

        console.log('✅ Test deleted:', id);

        return NextResponse.json({ message: 'Test deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting test:', error);
        return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
    }
}
