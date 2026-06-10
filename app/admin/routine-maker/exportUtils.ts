import { GridState, FacultyData } from './constraintUtils';
import Papa from 'papaparse';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MARKS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const TIME_LABELS = ['9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM'];
const COLORS = ["#FFDAB9", "#E6E6FA", "#E0FFFF", "#F0FFF0", "#FFFACD", "#F5DEB3", "#D8BFD8", "#F5F5DC"];

function processInfo(slot: any): string {
    if (!slot) return '';
    let info = `${slot.type}/${slot.course}/${slot.dept}/${slot.room}`.replace(/\/+$/, '');
    if (!info.startsWith('T') && !info.startsWith('L')) {
        info = 'L/' + info;
    }
    const parts = info.split('/');
    if (parts.length >= 4) {
        const before = parts.slice(0, 3).join('/') + '/';
        const after = parts.slice(3).join('/');
        return before + '\nRoom No.-' + after;
    }
    return info;
}

export function exportMasterCSV(grid: GridState) {
    const rows: string[][] = [];
    rows.push([' Routine Individual', ...TIME_LABELS]);

    DAYS.forEach((day, dIdx) => {
        const dayRows = grid[day] || [];
        if (dayRows.length === 0) return;
        
        let isFirstRowForDay = true;
        dayRows.forEach(row => {
            const facRow = Array(10).fill('');
            const detRow = Array(10).fill('');
            
            if (isFirstRowForDay) {
                facRow[0] = DAY_MARKS[dIdx];
                isFirstRowForDay = false;
            }

            let hasData = false;
            row.slots.forEach((slot, pIdx) => {
                if (slot && slot.faculty) {
                    facRow[pIdx + 1] = slot.faculty;
                    let rawStr = `${slot.type === 'P' ? 'P/' : slot.type === 'L' ? '' : slot.type + '/'}${slot.course}${slot.dept ? '/' + slot.dept : ''}${slot.room ? '/' + slot.room : ''}`;
                    // Attempt to reconstruct original raw string format as close as possible
                    if (slot.course.startsWith('CYBER') || slot.course.startsWith('CC301')) {
                        rawStr = slot.course;
                    } else {
                         rawStr = `${slot.type === 'T1' || slot.type === 'T2' ? slot.type + '/' : ''}${slot.course}${slot.dept ? '/' + slot.dept : ''}${slot.room ? '/' + slot.room : ''}`;
                    }
                    detRow[pIdx + 1] = rawStr;
                    hasData = true;
                }
            });

            if (hasData) {
                rows.push(facRow);
                rows.push(detRow);
            }
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
    
    // Create header row
    const header = Array(60).fill('');
    header[1] = 'Faculty List';
    for (let i = 0; i < 45; i++) header[4 + i] = `Slot ${i + 1}`; // E to AW is 4 to 48 (45 cols)
    header[49] = 'Total Slots'; // AX
    header[50] = 'Calculated Load'; // AY
    header[51] = 'T1 Count'; // AZ
    header[52] = 'P Count'; // BA
    header[53] = ''; // BB
    header[54] = 'BC'; // BC
    header[55] = 'BD'; // BD
    header[56] = 'BE'; // BE
    header[57] = 'BF'; // BF
    header[58] = 'BG'; // BG

    rows.push(header);

    faculties.forEach(fac => {
        const row = Array(60).fill('');
        row[1] = fac.code; // B

        let totalSlots = 0;
        let loadCount = 0;
        let pureLCount = 0;
        let t1Count = 0;
        let p3Count = 0;
        let l1Count = 0;
        let m12 = 0;

        let slotIdx = 4; // E is col index 4

        DAYS.forEach(day => {
            for (let p = 0; p < 9; p++) {
                // Find all slots for this faculty at this day & period
                const periodSlots = (grid[day] || []).map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                
                if (periodSlots.length > 0) {
                    const slot = periodSlots[0]; // Take first match if parallel
                    let rawStr = `${slot.course}`;
                    if (slot.type === 'T1' || slot.type === 'T2') rawStr = `${slot.type}/${slot.course}`;
                    if (slot.type === 'P') rawStr = `P/${slot.course}`;

                    // Apply mapping rules
                    let mapped = '';
                    if (rawStr.startsWith('MTH2252')) {
                        mapped = '4P';
                    } else {
                        for (const rule of mappingRules) {
                            if (rawStr.startsWith(rule.startsWith)) {
                                mapped = rule.mapsTo;
                                break;
                            }
                        }
                    }

                    if (!mapped) mapped = '1L'; // Fallback

                    row[slotIdx] = mapped;
                    totalSlots++;

                    if (['2L','4L','6L','8L','M1','M2'].includes(mapped)) {
                        loadCount += 1;
                        pureLCount += 1; 
                    }
                    if (mapped === '4P' || mapped === '3P') {
                        loadCount += 0.5;
                        p3Count++;
                    }
                    if (mapped === '2T') t1Count++;
                    if (mapped === '2L') l1Count++;
                    if (['M1','M2'].includes(mapped)) m12++;
                }
                slotIdx++;
            }
        });

        const bc = pureLCount + t1Count + p3Count;
        const bd = loadCount + t1Count;
        const be = l1Count + t1Count;
        const bf = bd - be - m12;

        row[49] = totalSlots; // AX
        row[50] = loadCount;  // AY
        row[51] = t1Count;    // AZ
        row[52] = p3Count;    // BA
        row[54] = bc;         // BC
        row[55] = bd;         // BD
        row[56] = be;         // BE
        row[57] = bf;         // BF
        row[58] = m12;        // BG

        rows.push(row);
    });

    downloadCSV(Papa.unparse(rows), 'Load_Matrix.csv');
}

export function exportFacultyPDFs(grid: GridState, faculties: FacultyData[]) {
    // Generate a printable HTML representation matching the "Split by Faculty" output
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let html = `
    <html>
    <head>
        <title>Faculty Routines</title>
        <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; }
            .page { page-break-after: always; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
            th, td { border: 1px solid #000; padding: 4px; text-align: center; word-wrap: break-word; vertical-align: middle; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .faculty-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; text-align: center; }
            .day-col { width: 60px; font-weight: bold; background-color: #f0f0f0; }
            .slot { white-space: pre-wrap; }
        </style>
    </head>
    <body>
    `;

    faculties.forEach(fac => {
        let lCount = 0;
        let t1Count = 0;

        // Gather slots and check for T1/T2 pairs
        const matchData: any[] = [];
        const printGrid: any[][] = [];

        DAYS.forEach((day, dIdx) => {
            const dayRow = Array(9).fill('');
            const daySlots = grid[day] || [];
            
            for (let p = 0; p < 9; p++) {
                // Find all slots for this faculty at this day & period
                const periodSlots = daySlots.map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                if (periodSlots.length > 0) {
                    const slot = periodSlots[0];
                    if (!slot) continue;

                    const info = processInfo(slot);
                    dayRow[p] = { text: info, bg: '' };

                    if (slot.type === 'T1' || slot.type === 'T2') {
                        const key = slot.course.replace(/[^A-Za-z0-9]/g, '');
                        matchData.push({
                            tag: slot.type,
                            key: key,
                            r: dIdx,
                            c: p
                        });
                        if (slot.type === 'T1') t1Count++;
                    } else {
                        lCount++;
                    }
                } else {
                    dayRow[p] = { text: '', bg: '' };
                }
            }
            printGrid.push(dayRow);
        });

        // Highlight T1/T2 pairs
        const used = new Set();
        let colorIndex = 0;

        matchData.forEach((t1, i) => {
            if (t1.tag === 'T1' && !used.has(i)) {
                const t2Index = matchData.findIndex((t2, j) => 
                    j !== i && t2.tag === 'T2' && t1.key === t2.key && !used.has(j)
                );
                if (t2Index !== -1) {
                    const t2 = matchData[t2Index];
                    const color = COLORS[colorIndex % COLORS.length];
                    printGrid[t1.r][t1.c].bg = color;
                    printGrid[t2.r][t2.c].bg = color;
                    used.add(i);
                    used.add(t2Index);
                    colorIndex++;
                }
            }
        });

        html += `
        <div class="page">
            <div class="faculty-title">Routine for ${fac.code}</div>
            <table>
                <thead>
                    <tr>
                        <th class="day-col">Day / Time</th>
                        ${TIME_LABELS.map(t => `<th>${t}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${DAYS.map((day, dIdx) => `
                        <tr>
                            <td class="day-col">${DAY_MARKS[dIdx]}</td>
                            ${printGrid[dIdx].map(cell => `<td class="slot" style="background-color: ${cell.bg || 'transparent'};">${cell.text}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div><strong>Summary:</strong> Lecture Count: ${lCount} | T1 Count: ${t1Count} | Total Load: ${lCount + t1Count}</div>
        </div>
        `;
    });

    html += `
        <script>
            window.onload = function() { window.print(); window.close(); }
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
