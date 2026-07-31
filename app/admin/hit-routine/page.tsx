'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Building2, CalendarDays, LayoutGrid, RefreshCw,
    Plus, Trash2, ToggleLeft, ToggleRight, X, Clock,
    CheckCircle2, Circle, AlertTriangle, Download, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxQqF87JuYNVHtxOhBdU2ujfiXQwRrpI62xghfinQkjhziR_uxxIbBD9sK6zOd0BgInUw/exec';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [
    { id: 1, time: '9:00–10:00' },
    { id: 2, time: '10:00–11:00' },
    { id: 3, time: '11:00–12:00' },
    { id: 4, time: '12:00–1:00' },
    { id: 5, time: '1:00–2:00' },
    { id: 6, time: '2:00–3:00' },
    { id: 7, time: '3:00–4:00' },
    { id: 8, time: '4:00–5:00' },
];

const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {};
const PALETTE = [
    { bg: 'bg-rose-950/50', border: 'border-rose-500/50', text: 'text-rose-200', accent: 'text-rose-400' },
    { bg: 'bg-indigo-950/50', border: 'border-indigo-500/50', text: 'text-indigo-200', accent: 'text-indigo-400' },
    { bg: 'bg-emerald-950/50', border: 'border-emerald-500/50', text: 'text-emerald-200', accent: 'text-emerald-400' },
    { bg: 'bg-amber-950/50', border: 'border-amber-500/50', text: 'text-amber-200', accent: 'text-amber-400' },
    { bg: 'bg-cyan-950/50', border: 'border-cyan-500/50', text: 'text-cyan-200', accent: 'text-cyan-400' },
    { bg: 'bg-fuchsia-950/50', border: 'border-fuchsia-500/50', text: 'text-fuchsia-200', accent: 'text-fuchsia-400' },
    { bg: 'bg-orange-950/50', border: 'border-orange-500/50', text: 'text-orange-200', accent: 'text-orange-400' },
    { bg: 'bg-teal-950/50', border: 'border-teal-500/50', text: 'text-teal-200', accent: 'text-teal-400' },
];

function getDeptColor(dept: string) {
    if (!DEPT_COLORS[dept]) {
        const idx = Object.keys(DEPT_COLORS).length % PALETTE.length;
        DEPT_COLORS[dept] = PALETTE[idx];
    }
    return DEPT_COLORS[dept];
}

type RoutineEntry = {
    day: string; group: string; period: number;
    classType: string; courseCode: string; department: string;
    faculty: string; roomNo: string;
};

type ValidationWarning = {
    id: string;
    type: 'warning' | 'error';
    title: string;
    description: string;
    relatedCells: { day: string; period: number; group: string }[];
};

type RoomDoc = {
    _id: string; roomNo: string; label: string;
    building: string; capacity: number; isActive: boolean; source: string;
};

type Tab = 'routine' | 'availability' | 'rooms';

function getCurrentPeriod(): { day: string; period: number } | null {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dayIdx = now.getDay(); // 0=Sun, 1=Mon, ...
    if (dayIdx === 0 || dayIdx === 6) return null;
    const day = DAYS[dayIdx - 1];
    const hour = now.getHours();
    if (hour < 9 || hour >= 17) return null;
    const period = hour - 8; // 9AM=1, 10AM=2, ...
    return { day, period };
}

export default function HitRoutinePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [tab, setTab] = useState<Tab>('routine');

    // Routine data
    const [rawRoutines, setRawRoutines] = useState<RoutineEntry[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [activeDept, setActiveDept] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [syncError, setSyncError] = useState('');

    // Validation
    const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
    const [activeWarningId, setActiveWarningId] = useState<string | null>(null);
    const [showWarningNote, setShowWarningNote] = useState(true);

    // Room availability
    const [selectedCell, setSelectedCell] = useState<{ day: string; period: number } | null>(null);

    // Room management
    const [rooms, setRooms] = useState<RoomDoc[]>([]);
    const [roomsLoading, setRoomsLoading] = useState(false);
    const [addForm, setAddForm] = useState({ roomNo: '', label: '', building: '', capacity: '' });
    const [addingRoom, setAddingRoom] = useState(false);

    // Auth check
    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (!stored) { router.push('/admin/login'); return; }
        const u = JSON.parse(stored);
        
        const isGA = localStorage.getItem('globalAdminActive') === 'true';
        const allowedEmails = [
            'ritwick92@gmail.com',
            'dipankar.chakraborty@heritageit.edu',
            'sandip.chatterjee@heritageit.edu'
        ];
        
        if (!isGA && (!u.email || !allowedEmails.includes(u.email.toLowerCase()))) { 
            router.push('/admin/dashboard'); 
            return; 
        }
        setUser(u);
    }, [router]);

    const getHeaders = () => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('auth_token');
        const h: Record<string, string> = {};
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (u.email) h['X-User-Email'] = u.email;
        return h;
    };

    // ── Sync from Google Sheets ──────────────────────────────────────────────
    const syncRoutine = useCallback(async () => {
        setSyncing(true);
        setSyncError('');
        try {
            const res = await fetch(GAS_URL);
            if (!res.ok) throw new Error('Failed to reach Google Sheets API');
            const json = await res.json();
            if (json.error) throw new Error(json.error);

            let rawData: any[][] = json.data || [];
            if (rawData.length > 0 && rawData[0][0]?.toLowerCase() === 'day') rawData.shift();

            const depts = new Set<string>();
            const entries: RoutineEntry[] = rawData.map((row: any[]) => {
                const clean = row.map((c: any) => (c ? String(c).trim() : ''));
                if (clean.length < 8) return null;
                const dept = clean[5] || 'Unknown';
                if (dept && dept !== 'Unknown') depts.add(dept);
                return {
                    day: clean[0], group: clean[1], period: parseInt(clean[2]),
                    classType: clean[3], courseCode: clean[4], department: dept,
                    faculty: clean[6], roomNo: clean[7],
                };
            }).filter(Boolean) as RoutineEntry[];

            setRawRoutines(entries);
            const deptArr = Array.from(depts).sort();
            setDepartments(deptArr);
            if (deptArr.length > 0 && !activeDept) setActiveDept(deptArr[0]);
            setLastSynced(new Date());
            toast.success(`Synced ${entries.length} entries from Google Sheets`);
        } catch (e: any) {
            setSyncError(e.message);
            toast.error('Sync failed: ' + e.message);
        } finally {
            setSyncing(false);
        }
    }, [activeDept]);

    // ── Fetch rooms from DB ──────────────────────────────────────────────────
    const fetchRooms = useCallback(async () => {
        setRoomsLoading(true);
        try {
            const res = await fetch('/api/admin/rooms', { headers: getHeaders() });
            if (res.ok) setRooms(await res.json());
        } finally {
            setRoomsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) { syncRoutine(); fetchRooms(); }
    }, [user]);

    // ── Sync rooms from routine ──────────────────────────────────────────────
    const syncRoomsFromRoutine = async () => {
        const routineRooms = [...new Set(rawRoutines.map(r => r.roomNo).filter(r => r && r !== 'NA' && r !== 'N/A'))];
        if (routineRooms.length === 0) { toast.error('No room data in routine. Sync the routine first.'); return; }
        try {
            const res = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ roomNo: '_bulk_', rooms: routineRooms.map(r => ({ roomNo: r })), source: 'routine' }),
            });
            if (res.ok) { toast.success(`Synced ${routineRooms.length} rooms from routine`); fetchRooms(); }
        } catch { toast.error('Failed to sync rooms'); }
    };

    // ── Add room manually ────────────────────────────────────────────────────
    const addRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.roomNo.trim()) return;
        setAddingRoom(true);
        try {
            const res = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({ ...addForm, capacity: Number(addForm.capacity) || 0, source: 'manual', addedBy: user?.name }),
            });
            if (res.ok) {
                toast.success('Room added');
                setAddForm({ roomNo: '', label: '', building: '', capacity: '' });
                fetchRooms();
            } else {
                const d = await res.json();
                toast.error(d.error || 'Failed to add room');
            }
        } finally { setAddingRoom(false); }
    };

    const deleteRoom = async (roomNo: string) => {
        if (!confirm(`Delete room ${roomNo}?`)) return;
        const res = await fetch(`/api/admin/rooms?roomNo=${roomNo}`, { method: 'DELETE', headers: getHeaders() });
        if (res.ok) { toast.success('Room deleted'); fetchRooms(); }
    };

    const toggleRoom = async (roomNo: string, isActive: boolean) => {
        const res = await fetch('/api/admin/rooms', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getHeaders() },
            body: JSON.stringify({ roomNo, isActive: !isActive }),
        });
        if (res.ok) fetchRooms();
    };

    // ── Compute routine rooms (auto-detected) ───────────────────────────────
    const routineRoomSet = new Set(rawRoutines.map(r => r.roomNo).filter(r => r && r !== 'NA' && r !== 'N/A'));
    const allRoomNos = new Set([
        ...rooms.filter(r => r.isActive).map(r => r.roomNo),
        ...routineRoomSet,
    ]);

    // ── Room availability for selected cell ──────────────────────────────────
    const getCellData = (day: string, period: number) => {
        const occupied = rawRoutines.filter(r =>
            r.day?.toLowerCase() === day.toLowerCase() &&
            r.period === period &&
            r.roomNo && r.roomNo !== 'NA' && r.roomNo !== 'N/A'
        );
        const occupiedRoomNos = new Set(occupied.map(r => r.roomNo.toUpperCase()));
        const free = [...allRoomNos].filter(rn => !occupiedRoomNos.has(rn.toUpperCase()));
        return { occupied, free };
    };

    // Grid data for routine tab (dept-filtered, Group 1 & 2)
    const buildGridData = () => {
        const grid: Record<string, Record<string, Record<number, RoutineEntry[]>>> = {};
        DAYS.forEach(day => {
            grid[day] = { 'Group 1': {}, 'Group 2': {} };
            PERIODS.forEach(p => { grid[day]['Group 1'][p.id] = []; grid[day]['Group 2'][p.id] = []; });
        });
        const deptRoutines = rawRoutines.filter(r => r.department === activeDept);
        deptRoutines.forEach(r => {
            const targetDay = DAYS.find(d => d.toLowerCase() === r.day?.toLowerCase());
            if (!targetDay || isNaN(r.period) || r.period < 1 || r.period > 8) return;
            const grp = (r.group || '').toLowerCase();
            const g1 = grp.includes('1') || grp === 'all' || grp === '' || grp === 'na';
            const g2 = grp.includes('2') || grp === 'all' || grp === '' || grp === 'na';
            if (g1) grid[targetDay]['Group 1'][r.period].push(r);
            if (g2) grid[targetDay]['Group 2'][r.period].push(r);
        });
        return grid;
    };

    const currentPeriod = getCurrentPeriod();
    const gridData = buildGridData();

    // ── Validation Engine ───────────────────────────────────────────────────
    const validateActiveDepartment = useCallback(() => {
        if (!activeDept || rawRoutines.length === 0) {
            setWarnings([]);
            return;
        }
        
        const deptRoutines = rawRoutines.filter(r => r.department === activeDept);
        const newWarnings: ValidationWarning[] = [];
        let warningIdCounter = 1;

        const addWarn = (title: string, desc: string, cells: { day: string; period: number; group: string }[], isError = false) => {
            newWarnings.push({
                id: `warn-${warningIdCounter++}`,
                type: isError ? 'error' : 'warning',
                title,
                description: desc,
                relatedCells: cells
            });
        };

        const isLab = (type: string) => {
            const t = (type || '').toUpperCase();
            return t.includes('LAB') || t === 'P';
        };

        DAYS.forEach(day => {
            const dayRoutines = deptRoutines.filter(r => r.day?.toLowerCase() === day.toLowerCase());
            const groups = ['Group 1', 'Group 2'];

            if (dayRoutines.length > 0) { // Only check if dept has classes this day
                groups.forEach(grp => {
                    const grpEntries = dayRoutines.filter(r => {
                        const g = (r.group || '').toLowerCase();
                        return g.includes(grp.replace('Group ', '')) || g === 'all' || g === '' || g === 'na';
                    });

                    // 1) Back to back same class (unless Lab)
                    const sorted = [...grpEntries].sort((a, b) => a.period - b.period);
                    for (let i = 0; i < sorted.length - 1; i++) {
                        const cur = sorted[i];
                        const nxt = sorted[i+1];
                        if (cur.period + 1 === nxt.period && 
                            cur.courseCode === nxt.courseCode && 
                            cur.faculty === nxt.faculty && 
                            cur.classType?.toUpperCase() !== 'BREAK' &&
                            !isLab(cur.classType) && !isLab(nxt.classType)) {
                            const isLibClass = (cur.classType || '').toUpperCase().includes('LIBRARY') || (cur.courseCode || '').toUpperCase().includes('LIBRARY');
                            const warningDesc = isLibClass 
                                ? `Two Library slots on ${day} (${grp}).`
                                : `${cur.faculty} has consecutive theory classes for ${cur.courseCode} on ${day} (${grp}).`;

                            addWarn('Back-to-Back Classes', warningDesc, 
                                [{ day, period: cur.period, group: grp }, { day, period: nxt.period, group: grp }]
                            );
                        }
                    }

                    // 2 & 4) No Remedial, Library, or Break in first 3 periods
                    for (let p = 1; p <= 3; p++) {
                        const entries = grpEntries.filter(r => r.period === p);
                        entries.forEach(e => {
                            const ct = (e.classType || '').toUpperCase();
                            const cc = (e.courseCode || '').toUpperCase();
                            if (ct.includes('REMEDIAL') || cc.includes('REMEDIAL') || ct.includes('LIBRARY') || cc.includes('LIBRARY')) {
                                addWarn('Early Remedial/Library', `Found Remedial/Library class in Period ${p} on ${day} (${grp}).`, [{ day, period: p, group: grp }]);
                            }
                            if (ct.includes('BREAK') || cc.includes('BREAK')) {
                                addWarn('Early Break', `Found Break in Period ${p} on ${day} (${grp}).`, [{ day, period: p, group: grp }]);
                            }
                        });
                    }

                    // 3) Lab followed by one class and day is over
                    const labEntries = sorted.filter(e => isLab(e.classType));
                    if (labEntries.length > 0) {
                        for (let i = 0; i < sorted.length; i++) {
                            if (isLab(sorted[i].classType)) {
                                let labEndIdx = i;
                                while (labEndIdx + 1 < sorted.length && isLab(sorted[labEndIdx+1].classType) && sorted[labEndIdx+1].period === sorted[labEndIdx].period + 1 && sorted[labEndIdx+1].courseCode === sorted[i].courseCode) {
                                    labEndIdx++;
                                }
                                const labEndPeriod = sorted[labEndIdx].period;
                                const nextClass = sorted.find(e => e.period === labEndPeriod + 1);
                                if (nextClass && nextClass.classType?.toUpperCase() !== 'BREAK') {
                                    const hasMoreClasses = sorted.some(e => e.period > labEndPeriod + 1 && e.classType?.toUpperCase() !== 'BREAK');
                                    if (!hasMoreClasses) {
                                        addWarn('Lab Followed By Single Class', 
                                            `A lab ends at Period ${labEndPeriod}, followed by a single class at Period ${labEndPeriod + 1} and no more classes on ${day} (${grp}).`, 
                                            [{ day, period: labEndPeriod, group: grp }, { day, period: labEndPeriod + 1, group: grp }]
                                        );
                                    }
                                }
                                i = labEndIdx; 
                            }
                        }
                    }

                    // 5) Empty slot in first 3 classes
                    for (let p = 1; p <= 3; p++) {
                        const entries = grpEntries.filter(r => r.period === p);
                        if (entries.length === 0) {
                            addWarn('Empty Early Slot', `No class scheduled in Period ${p} on ${day} for ${grp}.`, [{ day, period: p, group: grp }]);
                        }
                    }
                });
            }
        });

        const deduplicatedWarnings: ValidationWarning[] = [];
        newWarnings.forEach(w => {
            const normalizedDesc = w.description.replace(/\(Group \d\)/, '(Group 1 & 2)');
            const existing = deduplicatedWarnings.find(dw => 
                dw.title === w.title && 
                dw.description.replace(/\(Group \d\)/, '(Group 1 & 2)') === normalizedDesc
            );
            if (existing) {
                existing.description = normalizedDesc;
                existing.relatedCells.push(...w.relatedCells);
            } else {
                deduplicatedWarnings.push({ ...w });
            }
        });

        setWarnings(deduplicatedWarnings);
        setActiveWarningId(null);
    }, [activeDept, rawRoutines]);

    useEffect(() => {
        validateActiveDepartment();
    }, [validateActiveDepartment]);

    const checkRoomClashes = () => {
        const newWarnings: ValidationWarning[] = [];
        let warningIdCounter = 1000;
        const roomMap: Record<string, RoutineEntry[]> = {}; 

        rawRoutines.forEach(r => {
            if (!r.roomNo || r.roomNo === 'NA' || r.roomNo === 'N/A') return;
            if (r.classType?.toUpperCase() === 'BREAK') return;
            const key = `${r.day?.toLowerCase()}-${r.period}-${r.roomNo.toUpperCase()}`;
            if (!roomMap[key]) roomMap[key] = [];
            roomMap[key].push(r);
        });

        Object.entries(roomMap).forEach(([key, entries]) => {
            const uniqueClasses = new Set(entries.map(e => `${e.courseCode}-${e.faculty}-${e.department}`));
            if (uniqueClasses.size > 1) {
                const [day, periodStr, room] = key.split('-');
                const period = parseInt(periodStr);
                const displayDay = day.charAt(0).toUpperCase() + day.slice(1);
                
                const cells: { day: string; period: number; group: string }[] = [];
                entries.forEach(e => {
                    const g = e.group.toLowerCase();
                    if (g.includes('1') || g === 'all' || g === '' || g === 'na') cells.push({ day: displayDay, period, group: 'Group 1' });
                    if (g.includes('2') || g === 'all' || g === '' || g === 'na') cells.push({ day: displayDay, period, group: 'Group 2' });
                });

                newWarnings.push({
                    id: `clash-${warningIdCounter++}`,
                    type: 'error',
                    title: 'Room Clash',
                    description: `Room ${room} is double-booked on ${displayDay} Period ${period}. (${Array.from(uniqueClasses).join(', ')})`,
                    relatedCells: cells
                });
            }
        });

        setWarnings(newWarnings);
        setActiveWarningId(null);
        if (newWarnings.length === 0) toast.success('No room clashes found globally!');
        else toast.error(`Found ${newWarnings.length} room clashes!`);
    };

    const CourseStatistics = () => {
        const stats: Record<string, { L: number, T: number, P: number }> = {};
        
        const countClass = (r: RoutineEntry) => {
            const cc = r.courseCode || 'Unknown';
            const ccUpper = cc.toUpperCase();
            if (cc === 'Unknown' || ccUpper === 'NA' || ccUpper === 'N/A' || r.classType?.toUpperCase() === 'BREAK') return;
            if (!stats[cc]) stats[cc] = { L: 0, T: 0, P: 0 };
            const type = (r.classType || '').toUpperCase();
            if (type.includes('LAB') || type === 'P') stats[cc].P++;
            else if (type === 'T' || type.includes('TUTORIAL')) stats[cc].T++;
            else stats[cc].L++;
        };

        DAYS.forEach(day => {
            PERIODS.forEach(p => {
                const classesG1 = gridData[day]?.['Group 1']?.[p.id] || [];
                const classesG2 = gridData[day]?.['Group 2']?.[p.id] || [];
                
                const isIdentical = classesG1.length > 0 && classesG1.length === classesG2.length && classesG1.every((c, i) => c.classType === classesG2[i].classType && c.courseCode === classesG2[i].courseCode && c.faculty === classesG2[i].faculty && c.roomNo === classesG2[i].roomNo);

                classesG1.forEach(countClass);
                if (!isIdentical) {
                    classesG2.forEach(countClass);
                }
            });
        });
        const sortedCourses = Object.keys(stats).sort();
        if (sortedCourses.length === 0) return null;
        return (
            <div className="mt-8 bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-4">Course Workload Summary (Weekly)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700">
                                <th className="pb-2 font-bold">Course Code</th>
                                <th className="pb-2 font-bold text-center w-24">Lectures (L)</th>
                                <th className="pb-2 font-bold text-center w-24">Tutorials (T)</th>
                                <th className="pb-2 font-bold text-center w-24">Labs (P)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {sortedCourses.map(cc => (
                                <tr key={cc} className="text-slate-300">
                                    <td className="py-2">{cc}</td>
                                    <td className="py-2 text-center">{stats[cc].L}</td>
                                    <td className="py-2 text-center">{stats[cc].T}</td>
                                    <td className="py-2 text-center">{stats[cc].P}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const isCellHighlighted = (day: string, period: number, group: string) => {
        if (!activeWarningId) return false;
        const warning = warnings.find(w => w.id === activeWarningId);
        if (!warning) return false;
        return warning.relatedCells.some(c => c.day.toLowerCase() === day.toLowerCase() && c.period === period && c.group === group);
    };

    if (!user) return null;

    // ── Tab: Routine Grid ────────────────────────────────────────────────────
    const RoutineGrid = () => (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                {/* Dept selector */}
                <div className="relative">
                    <select
                        value={activeDept}
                        onChange={e => setActiveDept(e.target.value)}
                        className="appearance-none bg-slate-800 border border-slate-600 text-white text-sm font-bold rounded-xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
                </div>
                <SyncButton />
                <button onClick={checkRoomClashes} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-600/30 transition-all">
                    <AlertTriangle className="h-4 w-4" /> Check Room Clashes
                </button>
                {lastSynced && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last synced: {lastSynced.toLocaleTimeString('en-IN')}
                    </span>
                )}
            </div>

            {/* Validation Warnings & Note */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {showWarningNote && (
                    <div className="col-span-1 md:col-span-3 bg-blue-950/30 border border-blue-500/30 rounded-xl p-4 relative">
                        <button onClick={() => setShowWarningNote(false)} className="absolute top-3 right-3 text-blue-400 hover:text-blue-300"><X className="h-4 w-4" /></button>
                        <h3 className="text-blue-300 font-bold mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Validation Criteria</h3>
                        <ol className="list-decimal pl-5 text-xs text-blue-200/80 space-y-1">
                            <li>Same class (course code & faculty) should not have back to back 2 class (unless LAB/P)</li>
                            <li>No "Remedial" or "Library" class in the first 3 periods.</li>
                            <li>No situation where there is a Lab, after that exactly one class, and then day is over.</li>
                            <li>No "Break" period during the first 3 classes.</li>
                            <li>No empty slots in the first 3 classes (per group).</li>
                            <li>Global Room Clash Checker (click button above) finds room overlaps across all routines.</li>
                        </ol>
                    </div>
                )}
                {warnings.length > 0 && (
                    <div className="col-span-1 md:col-span-3 bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400"/> 
                            Validation Issues ({warnings.length})
                            <span className="text-xs font-normal text-slate-400 ml-2">Click an issue to highlight related cells</span>
                        </h3>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 pb-2">
                            {warnings.map(w => (
                                <button key={w.id} onClick={() => setActiveWarningId(activeWarningId === w.id ? null : w.id)}
                                    className={`text-left text-xs p-2.5 rounded-lg border transition-all flex-1 min-w-[250px] max-w-sm ${activeWarningId === w.id ? 'bg-amber-950/50 border-amber-500 shadow-md shadow-amber-900/20' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
                                    <div className={`font-bold ${w.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{w.title}</div>
                                    <div className="text-slate-400 mt-1">{w.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {syncError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
                    <WifiOff className="h-4 w-4 shrink-0" /> {syncError}
                </div>
            )}

            {rawRoutines.length === 0 && !syncing ? (
                <div className="text-center py-16 text-slate-500">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No data yet. Click <strong>Sync from Google Sheets</strong> to load the routine.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-2xl bg-slate-900">
                    <table className="w-full text-sm text-center border-collapse">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
                                <th className="p-3 w-24 border border-blue-600/40 font-black uppercase tracking-wider text-xs">Day</th>
                                <th className="p-3 w-20 border border-blue-600/40 font-black uppercase tracking-wider text-xs">Group</th>
                                {PERIODS.map(p => (
                                    <th key={p.id} className="p-3 min-w-[160px] border border-blue-600/40">
                                        <div className="font-bold text-sm">P{p.id}</div>
                                        <div className="text-[11px] text-blue-200/80">{p.time}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-slate-200">
                            {DAYS.map(day => (
                                <>
                                    {(['Group 1', 'Group 2'] as const).map((grp, gi) => (
                                        <tr key={`${day}-${grp}`} className="hover:bg-slate-800/30 transition-colors">
                                            {gi === 0 && (
                                                <td rowSpan={2} className="font-black text-slate-300 uppercase tracking-widest text-[11px] bg-slate-900 border border-slate-700 px-2">
                                                    {day.slice(0, 3)}
                                                </td>
                                            )}
                                            <td className="font-bold text-slate-400 bg-slate-800/30 text-[11px] border border-slate-700 px-2">
                                                G{gi + 1}
                                            </td>
                                            {PERIODS.map(p => {
                                                const classes = gridData[day]?.[grp]?.[p.id] || [];
                                                
                                                // Check for vertical merge
                                                const otherGrp = grp === 'Group 1' ? 'Group 2' : 'Group 1';
                                                const otherClasses = gridData[day]?.[otherGrp]?.[p.id] || [];
                                                const isIdentical = classes.length > 0 && classes.length === otherClasses.length && classes.every((c, i) => c.classType === otherClasses[i].classType && c.courseCode === otherClasses[i].courseCode && c.faculty === otherClasses[i].faculty && c.roomNo === otherClasses[i].roomNo);
                                                
                                                if (grp === 'Group 2' && isIdentical) {
                                                    return null; // Handled by Group 1 rowSpan
                                                }
                                                
                                                const rowSpan = (grp === 'Group 1' && isIdentical) ? 2 : 1;
                                                const isNow = currentPeriod?.day === day && currentPeriod?.period === p.id;
                                                const isHighlighted = isCellHighlighted(day, p.id, grp) || (rowSpan === 2 && isCellHighlighted(day, p.id, 'Group 2'));

                                                return (
                                                    <td key={p.id} rowSpan={rowSpan} className={`align-middle border border-slate-700 transition-all duration-300 ${isNow ? 'ring-1 ring-yellow-400/50 bg-yellow-950/10' : ''} ${isHighlighted ? 'ring-2 ring-amber-400 bg-amber-950/30 z-10 relative shadow-[0_0_15px_rgba(251,191,36,0.3)]' : ''}`}>
                                                        {classes.length === 0 ? (
                                                            <div className="h-16 flex items-center justify-center text-slate-700 text-xs">—</div>
                                                        ) : (
                                                            <div className="p-1 flex flex-col gap-1">
                                                                {classes.map((cls, ci) => {
                                                                    if (cls.classType?.toUpperCase() === 'BREAK') return (
                                                                        <div key={ci} className="flex items-center justify-center h-12 bg-slate-800/60 rounded text-slate-500 text-[10px] font-bold">☕ BREAK</div>
                                                                    );
                                                                    const theme = getDeptColor(cls.courseCode || cls.department);
                                                                    const isLibrary = (cls.classType || '').toUpperCase().includes('LIBRARY') || (cls.courseCode || '').toUpperCase().includes('LIBRARY');
                                                                    return (
                                                                        <div key={ci} className={`flex flex-col items-center p-1.5 rounded border-l-2 ${theme.bg} ${theme.border} text-center ${rowSpan === 2 ? 'h-full justify-center' : ''}`}>
                                                                            <div className={`font-bold text-[11px] ${theme.text}`}>{cls.classType} · {cls.courseCode}</div>
                                                                            {!isLibrary && (
                                                                                <div className="text-[10px] text-slate-400">{cls.faculty || 'NA'} · {cls.roomNo || 'NA'}</div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CourseStatistics />
        </div>
    );

    // ── Tab: Room Availability ───────────────────────────────────────────────
    const RoomAvailability = () => {
        const cellData = selectedCell ? getCellData(selectedCell.day, selectedCell.period) : null;

        return (
            <div className="flex gap-4">
                {/* Grid */}
                <div className="flex-1 space-y-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <SyncButton />
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" /> Mostly occupied
                            <span className="w-3 h-3 rounded-sm bg-amber-500/60 inline-block ml-1" /> Mixed
                            <span className="w-3 h-3 rounded-sm bg-emerald-500/60 inline-block ml-1" /> Mostly free
                        </div>
                        {lastSynced && <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />{lastSynced.toLocaleTimeString('en-IN')}</span>}
                    </div>
                    <p className="text-xs text-slate-500">Click any cell to see room-by-room occupancy details →</p>

                    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-800 to-slate-700">
                                    <th className="p-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider border border-slate-700 w-24">Day</th>
                                    {PERIODS.map(p => (
                                        <th key={p.id} className="p-2 border border-slate-700 text-center">
                                            <div className="text-xs font-bold text-slate-300">P{p.id}</div>
                                            <div className="text-[10px] text-slate-500">{p.time}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map(day => (
                                    <tr key={day} className="hover:bg-slate-800/20">
                                        <td className="p-3 font-black text-slate-300 text-xs uppercase tracking-wider border border-slate-700 bg-slate-900">
                                            {day.slice(0, 3)}
                                        </td>
                                        {PERIODS.map(p => {
                                            const { occupied, free } = getCellData(day, p.id);
                                            const total = occupied.length + free.length;
                                            const occupiedRooms = [...new Set(occupied.map(r => r.roomNo.toUpperCase()))];
                                            const freeCount = [...allRoomNos].filter(rn => !occupiedRooms.includes(rn.toUpperCase())).length;
                                            const isSelected = selectedCell?.day === day && selectedCell?.period === p.id;
                                            const isNow = currentPeriod?.day === day && currentPeriod?.period === p.id;
                                            const ratio = total > 0 ? occupiedRooms.length / total : 0;
                                            const cellColor = ratio > 0.6 ? 'bg-red-950/50 hover:bg-red-950/70 border-red-500/30'
                                                : ratio > 0.3 ? 'bg-amber-950/50 hover:bg-amber-950/70 border-amber-500/30'
                                                : 'bg-emerald-950/30 hover:bg-emerald-950/50 border-emerald-500/20';

                                            return (
                                                <td key={p.id}
                                                    className={`border border-slate-700 p-1 cursor-pointer transition-all ${cellColor} ${isSelected ? 'ring-2 ring-blue-400' : ''} ${isNow ? 'ring-1 ring-yellow-400' : ''}`}
                                                    onClick={() => setSelectedCell(isSelected ? null : { day, period: p.id })}
                                                >
                                                    <div className="text-center py-1 min-w-[70px]">
                                                        <div className="text-[11px] font-bold text-red-300">{occupiedRooms.length} busy</div>
                                                        <div className="text-[11px] font-bold text-emerald-400">{freeCount} free</div>
                                                        {isNow && <div className="text-[9px] text-yellow-400 font-bold mt-0.5">● NOW</div>}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Side Panel */}
                {selectedCell && cellData && (
                    <div className="w-80 shrink-0 space-y-3 animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-white text-sm">{selectedCell.day}</h3>
                                <p className="text-xs text-slate-400">{PERIODS.find(p => p.id === selectedCell.period)?.time}</p>
                            </div>
                            <button onClick={() => setSelectedCell(null)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Occupied */}
                        <div className="rounded-xl bg-red-950/30 border border-red-500/20 overflow-hidden">
                            <div className="px-3 py-2 bg-red-950/50 border-b border-red-500/20 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-xs font-black text-red-300 uppercase tracking-wider">
                                    Occupied ({[...new Set(cellData.occupied.map(r => r.roomNo.toUpperCase()))].length} rooms)
                                </span>
                            </div>
                            <div className="p-2 space-y-1.5 max-h-56 overflow-y-auto">
                                {cellData.occupied.length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-3">No rooms occupied</p>
                                ) : (
                                    // Group by room number
                                    Object.entries(
                                        cellData.occupied.reduce((acc, r) => {
                                            const key = r.roomNo.toUpperCase();
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(r);
                                            return acc;
                                        }, {} as Record<string, RoutineEntry[]>)
                                    ).sort(([a], [b]) => a.localeCompare(b)).map(([roomNo, entries]) => (
                                        <div key={roomNo} className="bg-red-950/40 rounded-lg p-2 border border-red-500/20">
                                            <div className="font-black text-red-200 text-sm">{roomNo}</div>
                                            {entries.map((e, i) => (
                                                <div key={i} className="text-[10px] text-slate-400 mt-0.5">
                                                    {e.classType} · {e.courseCode} · <span className="text-slate-300">{e.department}</span>
                                                    <br />{e.faculty} · Grp {e.group}
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Free */}
                        <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 overflow-hidden">
                            <div className="px-3 py-2 bg-emerald-950/50 border-b border-emerald-500/20 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                                    Free ({cellData.free.length} rooms)
                                </span>
                            </div>
                            <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
                                {cellData.free.length === 0 ? (
                                    <p className="text-xs text-slate-500 text-center py-3">No free rooms</p>
                                ) : (
                                    cellData.free.sort().map(rn => {
                                        const roomDoc = rooms.find(r => r.roomNo === rn);
                                        return (
                                            <div key={rn} className="flex items-center gap-2 bg-emerald-950/30 rounded-lg px-2.5 py-1.5 border border-emerald-500/15">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                                <div>
                                                    <div className="text-xs font-bold text-emerald-200">{rn}</div>
                                                    {roomDoc?.label && <div className="text-[10px] text-slate-400">{roomDoc.label}{roomDoc.building ? ` · ${roomDoc.building}` : ''}</div>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Quick summary */}
                        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 text-xs text-slate-400">
                            <div className="font-bold text-slate-300 mb-1">Quick Summary</div>
                            <div>Total tracked rooms: <span className="text-white font-bold">{allRoomNos.size}</span></div>
                            <div>Occupied: <span className="text-red-400 font-bold">{[...new Set(cellData.occupied.map(r => r.roomNo.toUpperCase()))].length}</span></div>
                            <div>Available: <span className="text-emerald-400 font-bold">{cellData.free.length}</span></div>
                            <div className="mt-1.5 text-[10px] text-slate-500">
                                Rooms = from routine + manually added
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Tab: Manage Rooms ────────────────────────────────────────────────────
    const ManageRooms = () => {
        const manualRooms = rooms.filter(r => r.source === 'manual');
        const routineDetectedRooms = rooms.filter(r => r.source === 'routine');
        const untracked = [...routineRoomSet].filter(rn => !rooms.find(r => r.roomNo === rn.toUpperCase()));

        return (
            <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Rooms', value: allRoomNos.size, color: 'text-blue-400' },
                        { label: 'Manual', value: manualRooms.length, color: 'text-purple-400' },
                        { label: 'From Routine', value: routineDetectedRooms.length, color: 'text-amber-400' },
                        { label: 'Untracked in DB', value: untracked.length, color: 'text-red-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
                            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    <button onClick={syncRoomsFromRoutine}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition-all">
                        <RefreshCw className="h-4 w-4" /> Sync Rooms from Routine
                    </button>
                    <SyncButton label="Re-sync Google Sheet" />
                </div>

                {untracked.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-400 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <strong>{untracked.length} rooms</strong> found in routine but not in DB: {untracked.join(', ')}
                            <br />Click <strong>Sync Rooms from Routine</strong> to add them.
                        </div>
                    </div>
                )}

                {/* Add Room Form */}
                <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-blue-400" /> Add Room Manually
                    </h3>
                    <form onSubmit={addRoom} className="flex flex-wrap gap-3">
                        <input required placeholder="Room No *" value={addForm.roomNo}
                            onChange={e => setAddForm(f => ({ ...f, roomNo: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 w-28 uppercase" />
                        <input placeholder="Label (e.g. CS Lab)" value={addForm.label}
                            onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[140px]" />
                        <input placeholder="Building" value={addForm.building}
                            onChange={e => setAddForm(f => ({ ...f, building: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 w-28" />
                        <input placeholder="Capacity" type="number" value={addForm.capacity}
                            onChange={e => setAddForm(f => ({ ...f, capacity: e.target.value }))}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 w-24" />
                        <button type="submit" disabled={addingRoom}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-50">
                            <Plus className="h-4 w-4" /> {addingRoom ? 'Adding...' : 'Add'}
                        </button>
                    </form>
                </div>

                {/* Room List */}
                {roomsLoading ? (
                    <div className="text-center py-8 text-slate-500 text-sm">Loading rooms...</div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">No rooms in DB. Add manually or sync from routine.</div>
                ) : (
                    <div className="rounded-xl border border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Room No</th>
                                    <th className="px-4 py-3 text-left">Label</th>
                                    <th className="px-4 py-3 text-left">Building</th>
                                    <th className="px-4 py-3 text-center">Capacity</th>
                                    <th className="px-4 py-3 text-center">Source</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {rooms.map(room => (
                                    <tr key={room._id} className={`hover:bg-slate-800/30 transition-colors ${!room.isActive ? 'opacity-50' : ''}`}>
                                        <td className="px-4 py-3 font-black text-white">{room.roomNo}</td>
                                        <td className="px-4 py-3 text-slate-300">{room.label || '—'}</td>
                                        <td className="px-4 py-3 text-slate-400">{room.building || '—'}</td>
                                        <td className="px-4 py-3 text-center text-slate-400">{room.capacity || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${room.source === 'manual' ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                {room.source}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => toggleRoom(room.roomNo, room.isActive)}
                                                className={`flex items-center gap-1 mx-auto text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${room.isActive ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                                                {room.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                                {room.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {room.source === 'manual' && (
                                                <button onClick={() => deleteRoom(room.roomNo)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ── Shared Sync Button ───────────────────────────────────────────────────
    const SyncButton = ({ label = 'Sync from Google Sheets' }: { label?: string }) => (
        <button onClick={syncRoutine} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 text-sm font-bold hover:bg-blue-600/30 transition-all disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : label}
        </button>
    );

    const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'routine', label: 'Master Routine', icon: CalendarDays },
        { id: 'availability', label: 'Room Availability', icon: Building2 },
        { id: 'rooms', label: 'Manage Rooms', icon: LayoutGrid },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 sm:p-6">
            <div className="max-w-[1400px] mx-auto space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-4 sm:p-5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                                <Building2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-white">HIT Routine</h1>
                                <p className="text-xs text-slate-500">Master routine · Room availability · Room management</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${lastSynced ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                            {lastSynced ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            {lastSynced ? 'Synced' : 'Not synced'}
                        </div>
                    </div>
                </div>

                {/* Tab Nav */}
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-fit">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            <t.icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div>
                    {tab === 'routine' && <RoutineGrid />}
                    {tab === 'availability' && <RoomAvailability />}
                    {tab === 'rooms' && <ManageRooms />}
                </div>
            </div>
        </div>
    );
}
