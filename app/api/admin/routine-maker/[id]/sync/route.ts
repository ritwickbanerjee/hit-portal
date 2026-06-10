import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Routine from '@/models/Routine';
import Config from '@/models/Config';
import Papa from 'papaparse';

export const runtime = 'nodejs';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MARKERS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

async function isAuthorized(req: NextRequest) {
    const email = req.headers.get('x-user-email') || '';
    if (!email) return false;
    await connectDB();
    const config = await Config.findOne({ key: 'data' });
    const authorized: string[] = config?.routineMakerAuthorizedEmails || ['ritwick92@gmail.com'];
    return authorized.map((e: string) => e.toLowerCase()).includes(email.toLowerCase());
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function parseSlotDetail(rawInfo: string) {
    if (!rawInfo || rawInfo.trim() === '') return null;

    let info = rawInfo.trim();
    let type = 'L';
    let course = '';
    let dept = '';
    let room = '';

    if (info.startsWith('T1/') || info.startsWith('T2/')) {
        type = info.substring(0, 2);
        info = info.substring(3);
    } else if (info.startsWith('P/')) {
        type = 'P';
        info = info.substring(2);
    } else if (info.startsWith('L/')) {
        type = 'L';
        info = info.substring(2);
    }

    const parts = info.split('/');
    course = parts[0] || '';
    dept = parts[1] || '';
    room = parts.slice(2).join('/') || '';

    if (rawInfo.startsWith('CYBER') || rawInfo.startsWith('CC301')) {
        course = rawInfo;
        dept = '';
        room = '';
        type = 'L';
    }

    return { faculty: '', type, course, dept, room };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAuthorized(req))) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        const { id } = await params;
        const routine = await Routine.findById(id);
        if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });

        // Fetch from Google Sheets using export endpoint to avoid gviz mangling
        const spreadsheetId = '1s7RsxAqylY-7vjZZfGz5VGlsTMNwW49HdxG82Jbc20M';
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=1100974876`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch from Google Sheets');

        const csvText = await response.text();
        const parsed = Papa.parse(csvText, { header: false });
        const lines = parsed.data as string[][];

        const grid: any = {};
        DAYS.forEach(day => grid[day] = []);

        const facultyCodes = new Set<string>();
        let currentDay: string | null = null;

        let i = 1;
        while (i < lines.length) {
            const line = lines[i];
            if (!line || line.length === 0) { i++; continue; }

            const firstCol = (line[0] || '').toUpperCase().trim();
            if (DAY_MARKERS.includes(firstCol)) {
                currentDay = DAYS[DAY_MARKERS.indexOf(firstCol)];
            }

            if (firstCol === 'LINK TO LOAD MATRIX' || firstCol === 'FACULTY CODE' || firstCol === 'DEPT & COURSE WISE') {
                break;
            }

            if (currentDay === null) { i++; continue; }

            const facRow = line;
            const detRow = (i + 1 < lines.length) ? lines[i + 1] : [];

            let hasData = false;
            for (let p = 1; p <= 9; p++) {
                if (facRow[p] && facRow[p].trim() && /^[A-Z]{2,3}$/.test(facRow[p].trim())) {
                    hasData = true;
                    break;
                }
            }

            if (!hasData) {
                i += 2;
                continue;
            }

            const slots = Array(9).fill(null);
            for (let p = 0; p < 9; p++) {
                const facCode = (facRow[p + 1] || '').trim();
                const detStr = (detRow[p + 1] || '').trim();

                if (facCode && /^[A-Z]{2,3}$/.test(facCode)) {
                    facultyCodes.add(facCode);
                    const parsedObj = parseSlotDetail(detStr);
                    if (parsedObj) {
                        parsedObj.faculty = facCode;
                        slots[p] = parsedObj;
                    } else {
                        slots[p] = { faculty: facCode, type: 'L', course: detStr, dept: '', room: '' };
                    }
                }
            }

            if (slots.some(s => s !== null)) {
                grid[currentDay].push({ id: generateId(), slots });
            }

            i += 2;
        }

        DAYS.forEach(day => {
            if (grid[day].length === 0) {
                grid[day].push({ id: generateId(), slots: Array(9).fill(null) });
            }
        });

        const sortedCodes = Array.from(facultyCodes).sort();
        const existingFaculties = routine.faculties || [];
        const newFaculties: any[] = [];

        const PRESET_COLORS = [
            '#E6194B', '#3CB44B', '#9A6324', '#4363D8', '#F58231',
            '#911EB4', '#008080', '#F032E6', '#808000', '#000075',
            '#E11D48', '#0E7490', '#800000', '#469990'
        ];

        sortedCodes.forEach((code, idx) => {
            const existing = existingFaculties.find((f: any) => f.code === code);
            if (existing) {
                newFaculties.push(existing);
            } else {
                newFaculties.push({
                    code,
                    name: code,
                    color: PRESET_COLORS[idx % PRESET_COLORS.length],
                    availability: {
                        Monday: Array(9).fill(true), Tuesday: Array(9).fill(true),
                        Wednesday: Array(9).fill(true), Thursday: Array(9).fill(true),
                        Friday: Array(9).fill(true),
                    }
                });
            }
        });

        routine.grid = grid;
        routine.faculties = newFaculties;
        if (routine.mappingRules) {
            routine.mappingRules = routine.mappingRules.filter((r: any) => r && r.startsWith && r.startsWith.trim() !== '');
        }
        await routine.save();

        return NextResponse.json({ message: 'Synced successfully', grid, faculties: newFaculties });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
