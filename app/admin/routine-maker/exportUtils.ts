import { GridState, FacultyData } from './constraintUtils';
import Papa from 'papaparse';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_LABELS = ['9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

export function exportMasterCSV(grid: GridState) {
    const rows: string[][] = [];
    rows.push(['Day', 'Row ID', ...TIME_LABELS]);

    DAYS.forEach(day => {
        const dayRows = grid[day] || [];
        dayRows.forEach(row => {
            const csvRow = [day, row.id];
            row.slots.forEach(slot => {
                if (!slot) csvRow.push('');
                else csvRow.push(`${slot.faculty}\n${slot.type}/${slot.course}/${slot.dept}/${slot.room}`);
            });
            rows.push(csvRow);
        });
    });

    downloadCSV(Papa.unparse(rows), 'Master_Routine.csv');
}

export function exportDeptCourseCSV(grid: GridState) {
    const data: any[] = [];
    
    DAYS.forEach(day => {
        const dayRows = grid[day] || [];
        dayRows.forEach(row => {
            row.slots.forEach((slot, idx) => {
                if (!slot || !slot.faculty) return;
                data.push({
                    Department: slot.dept,
                    Course: slot.course,
                    Faculty: slot.faculty,
                    Day: day,
                    TimeSlot: TIME_LABELS[idx],
                    ClassType: slot.type,
                    Room: slot.room,
                    RawString: `${slot.type}/${slot.course}/${slot.dept}/${slot.room}`
                });
            });
        });
    });

    data.sort((a, b) => {
        if (a.Department !== b.Department) return a.Department.localeCompare(b.Department);
        if (a.Course !== b.Course) return a.Course.localeCompare(b.Course);
        return 0;
    });

    downloadCSV(Papa.unparse(data), 'Dept_Course_View.csv');
}

export function exportLoadMatrixCSV(grid: GridState, faculties: FacultyData[], mappingRules: { startsWith: string, mapsTo: string }[]) {
    const rows: any[] = [];
    const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

    faculties.forEach(fac => {
        const row: any = { 'Faculty Code': fac.code };
        let totalSlots = 0;
        let lCount = 0;
        let pCount = 0;
        let t1Count = 0;

        DAYS.forEach((day, dIdx) => {
            const dKey = DAY_KEYS[dIdx];
            const facSlots: string[] = [];
            
            const dayRows = grid[day] || [];
            dayRows.forEach(r => {
                r.slots.forEach((slot, pIdx) => {
                    if (slot && slot.faculty === fac.code) {
                        totalSlots++;
                        let rawStr = `${slot.type}/${slot.course}/${slot.dept}`;
                        
                        // Apply mapping rules
                        let mapped = rawStr;
                        for (const rule of mappingRules) {
                            if (rawStr.startsWith(rule.startsWith)) {
                                mapped = rule.mapsTo;
                                break;
                            }
                        }

                        if (mapped.includes('L')) lCount += parseFloat(mapped) || 1;
                        if (mapped.includes('P')) pCount += parseFloat(mapped) || 1;
                        if (rawStr.includes('T1')) t1Count++;

                        facSlots.push(mapped);
                    }
                });
            });
            row[dKey] = facSlots.join(', ');
        });

        row['Total Slots'] = totalSlots;
        row['Lecture Count'] = lCount;
        row['Practical Count'] = pCount;
        row['T1 Count'] = t1Count;
        row['Total Load'] = lCount + (pCount * 0.5);

        rows.push(row);
    });

    downloadCSV(Papa.unparse(rows), 'Load_Matrix.csv');
}

export function exportFacultyPDFs() {
    window.print();
}

function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
