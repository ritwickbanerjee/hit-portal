import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Routine from '@/models/Routine';
import PublishedRoutine from '@/models/PublishedRoutine';
import Config from '@/models/Config';

export const runtime = 'nodejs';

const TIME_SLOTS = [
    '9:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 1:00 PM',
    '1:00 PM - 2:00 PM',
    '2:00 PM - 3:00 PM',
    '3:00 PM - 4:00 PM',
    '4:00 PM - 5:00 PM',
    '5:00 PM - 6:00 PM',
];

const DAY_MAP: Record<string, string> = {
    'Monday': 'MON',
    'Tuesday': 'TUE',
    'Wednesday': 'WED',
    'Thursday': 'THU',
    'Friday': 'FRI',
};

async function isAuthorized(req: NextRequest) {
    const email = req.headers.get('x-user-email') || '';
    if (!email) return false;
    await connectDB();
    const config = await Config.findOne({ key: 'data' });
    const authorized: string[] = config?.routineMakerAuthorizedEmails || ['ritwick92@gmail.com'];
    return authorized.map((e: string) => e.toLowerCase()).includes(email.toLowerCase());
}

function formatSlotContent(slot: any): string {
    if (!slot) return '';
    // Format: Type/Course/Dept/Room — same as Google Sheets format
    const parts = [slot.type || 'L', slot.course || '', slot.dept || '', slot.room || ''];
    let raw = parts.join('/').replace(/\/+$/, '');

    // Apply the same processInfo logic as the Apps Script
    if (!raw.startsWith('T') && !raw.startsWith('L')) {
        raw = 'L/' + raw;
    }
    const splitParts = raw.split('/');
    if (splitParts.length >= 4) {
        const before = splitParts.slice(0, 3).join('/') + '/';
        const after = splitParts.slice(3).join('/');
        return before + '\nRoom No.-' + after;
    }
    return raw;
}

// POST: Publish routine to My Routine
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const routine = await Routine.findById(id);
        if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });

        const email = req.headers.get('x-user-email') || '';
        const grid = routine.grid instanceof Map ? Object.fromEntries(routine.grid) : routine.grid;
        const faculties = routine.faculties || [];

        // Build per-faculty schedule
        const facultySchedules: Record<string, Record<string, any[]>> = {};

        faculties.forEach((fac: any) => {
            facultySchedules[fac.code] = {
                MON: [], TUE: [], WED: [], THU: [], FRI: []
            };
        });

        // Walk the grid
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        days.forEach(day => {
            const dayKey = DAY_MAP[day];
            const rows = grid[day] || [];
            rows.forEach((row: any) => {
                const slots = row.slots || [];
                slots.forEach((slot: any, pIdx: number) => {
                    if (slot && slot.faculty && facultySchedules[slot.faculty]) {
                        const content = formatSlotContent(slot);
                        facultySchedules[slot.faculty][dayKey].push({
                            time: TIME_SLOTS[pIdx] || `Period ${pIdx + 1}`,
                            group: '',
                            content: content,
                        });
                    }
                });
            });
        });

        // Upsert each faculty
        let count = 0;
        for (const [code, schedule] of Object.entries(facultySchedules)) {
            await PublishedRoutine.findOneAndUpdate(
                { facultyCode: code },
                {
                    facultyCode: code,
                    timeSlots: TIME_SLOTS,
                    routine: schedule,
                    publishedAt: new Date(),
                    publishedBy: email,
                },
                { upsert: true, new: true }
            );
            count++;
        }

        return NextResponse.json({
            message: `Published routine for ${count} faculties`,
            count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
