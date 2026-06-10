export type Slot = {
    faculty: string;
    type: string;
    course: string;
    dept: string;
    room: string;
} | null;

export type GridRow = {
    id: string;
    slots: Slot[];
};

export type GridState = Record<string, GridRow[]>;

export type FacultyData = {
    code: string;
    name: string;
    color: string;
    designation?: string;
    employeeCode?: string;
    availability: Record<string, boolean[]>; // day -> boolean[9]
};

export type ConstraintViolation = {
    id: string;
    type: 'warning' | 'error';
    title: string;
    description: string;
    day?: string;
    periodIndex?: number;
    faculty?: string;
};

export function checkConstraints(grid: GridState, faculties: FacultyData[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const facultyMap = new Map<string, FacultyData>();
    faculties.forEach(f => facultyMap.set(f.code, f));

    const weeklyFacultyCounts: Record<string, number> = {};
    const firstPeriodCounts: Record<string, number> = {};

    days.forEach(day => {
        const rows = grid[day] || [];
        
        const dailyFacultyCounts: Record<string, number> = {};
        const dailyFacultyPeriods: Record<string, Set<number>> = {};
        const roomPeriods: Record<string, Set<number>> = {}; // room -> set of periods
        
        rows.forEach(row => {
            row.slots.forEach((slot, pIndex) => {
                if (!slot || !slot.faculty) return;
                
                const fac = slot.faculty;
                
                // Track daily & weekly counts
                dailyFacultyCounts[fac] = (dailyFacultyCounts[fac] || 0) + 1;
                weeklyFacultyCounts[fac] = (weeklyFacultyCounts[fac] || 0) + 1;
                
                if (pIndex === 0) {
                    firstPeriodCounts[fac] = (firstPeriodCounts[fac] || 0) + 1;
                }

                // Check parallel conflict
                if (!dailyFacultyPeriods[fac]) dailyFacultyPeriods[fac] = new Set();
                if (dailyFacultyPeriods[fac].has(pIndex)) {
                    violations.push({
                        id: `parallel-${day}-${pIndex}-${fac}`,
                        type: 'error',
                        title: 'Parallel Conflict',
                        description: `${fac} is assigned to multiple classes on ${day} Period ${pIndex + 1}`,
                        day, periodIndex: pIndex, faculty: fac
                    });
                }
                dailyFacultyPeriods[fac].add(pIndex);

                // Check room conflict
                if (slot.room && slot.room !== '') {
                    if (!roomPeriods[slot.room]) roomPeriods[slot.room] = new Set();
                    if (roomPeriods[slot.room].has(pIndex)) {
                        violations.push({
                            id: `room-${day}-${pIndex}-${slot.room}`,
                            type: 'error',
                            title: 'Room Conflict',
                            description: `Room ${slot.room} is double-booked on ${day} Period ${pIndex + 1}`,
                            day, periodIndex: pIndex
                        });
                    }
                    roomPeriods[slot.room].add(pIndex);
                }

                // Check Availability
                const fData = facultyMap.get(fac);
                if (fData && fData.availability && fData.availability[day]) {
                    if (!fData.availability[day][pIndex]) {
                        violations.push({
                            id: `avail-${day}-${pIndex}-${fac}`,
                            type: 'error',
                            title: 'Availability Violation',
                            description: `${fac} is unavailable on ${day} Period ${pIndex + 1}`,
                            day, periodIndex: pIndex, faculty: fac
                        });
                    }
                }
            });
        });

        // Daily overload
        for (const [fac, count] of Object.entries(dailyFacultyCounts)) {
            if (count > 5) {
                violations.push({
                    id: `overload-${day}-${fac}`,
                    type: 'warning',
                    title: 'Daily Overload',
                    description: `${fac} has ${count} classes on ${day} (>5)`,
                    day, faculty: fac
                });
            }
        }

        // 3 Consecutive & 2-1-2 Fatigue
        for (const [fac, periodsSet] of Object.entries(dailyFacultyPeriods)) {
            const periods = Array.from(periodsSet).sort();
            
            // 3 Consecutive
            for (let i = 0; i < periods.length - 2; i++) {
                if (periods[i] + 1 === periods[i+1] && periods[i+1] + 1 === periods[i+2]) {
                    violations.push({
                        id: `3cons-${day}-${fac}-${periods[i]}`,
                        type: 'warning',
                        title: '3 Consecutive Classes',
                        description: `${fac} has 3 consecutive classes on ${day} (Periods ${periods[i]+1}, ${periods[i+1]+1}, ${periods[i+2]+1})`,
                        day, faculty: fac
                    });
                }
            }

            // 2-1-2 Fatigue
            for (let i = 0; i < periods.length - 3; i++) {
                if (periods[i] + 1 === periods[i+1] && periods[i+1] + 2 === periods[i+2] && periods[i+2] + 1 === periods[i+3]) {
                    violations.push({
                        id: `212-${day}-${fac}-${periods[i]}`,
                        type: 'warning',
                        title: '2-1-2 Fatigue Pattern',
                        description: `${fac} has a 2-gap-2 pattern on ${day}`,
                        day, faculty: fac
                    });
                }
            }
        }
    });

    // Max 1st Period
    for (const [fac, count] of Object.entries(firstPeriodCounts)) {
        if (count > 2) {
            violations.push({
                id: `1stperiod-${fac}`,
                type: 'warning',
                title: 'Max 1st-Period Classes',
                description: `${fac} has ${count} 1st-period classes this week (>2)`,
                faculty: fac
            });
        }
    }

    return violations;
}
