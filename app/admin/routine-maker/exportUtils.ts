import { GridState, FacultyData } from './constraintUtils';
import Papa from 'papaparse';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MARKS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const TIME_LABELS = ['9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM'];
const COLORS = ["#FFDAB9", "#E6E6FA", "#E0FFFF", "#F0FFF0", "#FFFACD", "#F5DEB3", "#D8BFD8", "#F5F5DC"];

function processInfo(slot: any): string {
    if (!slot) return '';
    let rawStr = '';
    if (slot.course.startsWith('CYBER') || slot.course.startsWith('CC301')) {
        rawStr = slot.course;
    } else {
        rawStr = `${slot.course}${slot.dept ? '/' + slot.dept : ''}${slot.room ? '/' + slot.room : ''}`;
    }
    
    let info = rawStr.trim();
    if (slot.type === 'T1' || slot.type === 'T2') {
        info = `${slot.type}/${info}`;
    } else if (slot.type === 'P') {
        info = `P/${info}`;
    } else if (slot.type === 'L') {
        info = `L/${info}`;
    } else {
        info = `L/${info}`;
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
                    if (!slot) continue;
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

export async function exportFacultyExcel(grid: GridState, faculties: FacultyData[]) {
    // Dynamically import to keep bundle small
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');

    const workbook = new ExcelJS.Workbook();
    
    // The exact COLORS used in the user's app script
    const COLORS = [
      "FFDAB9", "E6E6FA", "E0FFFF", "F0FFF0",
      "FFFACD", "F5DEB3", "D8BFD8", "F5F5DC"
    ];

    faculties.forEach(fac => {
        const sheet = workbook.addWorksheet(fac.code);

        // Define columns A to K
        sheet.columns = [
            { width: 6 },  // A: DAY
            { width: 6 },  // B: Gr
            { width: 22 }, // C: P1
            { width: 22 }, // D: P2
            { width: 22 }, // E: P3
            { width: 22 }, // F: P4
            { width: 22 }, // G: P5
            { width: 22 }, // H: P6
            { width: 22 }, // I: P7
            { width: 22 }, // J: P8
            { width: 22 }, // K: P9
        ];

        sheet.mergeCells('A1:H1');
        sheet.getCell('A1').value = 'Heritage Institute of Technology';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        
        sheet.mergeCells('I1:K1');
        sheet.getCell('I1').value = 'Faculty: ' + fac.code;
        sheet.getCell('I1').font = { bold: true, size: 12 };
        sheet.getCell('I1').alignment = { horizontal: 'right' };

        sheet.mergeCells('A2:H2');
        sheet.getCell('A2').value = 'TIME TABLE';
        sheet.getCell('A2').font = { bold: true, size: 12 };
        sheet.getCell('A2').alignment = { horizontal: 'center' };

        sheet.mergeCells('I2:K2'); // Will fill stats here later

        sheet.mergeCells('A3:I3');
        sheet.getCell('A3').value = 'B.Tech/M.Tech/MCA';
        sheet.getCell('A3').font = { bold: true };
        sheet.mergeCells('J3:K3');
        sheet.getCell('J3').value = 'SESSION: 2025-26';
        sheet.getCell('J3').font = { bold: true };
        sheet.getCell('J3').alignment = { horizontal: 'right' };

        const headerRow = sheet.getRow(4);
        headerRow.values = ['DAY', '', ...TIME_LABELS];
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        for (let c = 1; c <= 11; c++) {
            headerRow.getCell(c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }

        let rowIndex = 5;
        const matchData: any[] = [];
        let lCount = 0;
        let t1Count = 0;

        DAYS.forEach((day, dIdx) => {
            const dayRows = grid[day] || [];
            
            const row1 = sheet.getRow(rowIndex);
            const row2 = sheet.getRow(rowIndex + 1);
            
            // Set row heights to accommodate wrapText
            row1.height = 35;
            row2.height = 35;

            row1.getCell(1).value = DAY_MARKS[dIdx].substring(0, 3);
            sheet.mergeCells(`A${rowIndex}:A${rowIndex + 1}`);
            sheet.getCell(`A${rowIndex}`).alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            sheet.getCell(`A${rowIndex}`).font = { bold: true };

            row1.getCell(2).value = 'Gr. 1';
            row1.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
            row1.getCell(2).font = { bold: true };
            
            row2.getCell(2).value = 'Gr. 2';
            row2.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
            row2.getCell(2).font = { bold: true };

            for (let p = 0; p < 9; p++) {
                const periodSlots = dayRows.map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                
                if (periodSlots.length > 0) {
                    const slot1 = periodSlots[0];
                    if (slot1) {
                        const info1 = processInfo(slot1);
                        const cell1 = row1.getCell(p + 3);
                        cell1.value = info1;
                        cell1.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

                        if (slot1.type === 'T1' || slot1.type === 'T2') {
                            const key = slot1.course.replace(/[^A-Za-z0-9]/g, '');
                            matchData.push({ tag: slot1.type, key: key, cell: cell1 });
                            if (slot1.type === 'T1') t1Count++;
                        } else {
                            lCount++;
                        }
                    }

                    if (periodSlots.length > 1) {
                        const slot2 = periodSlots[1];
                        if (slot2) {
                            const info2 = processInfo(slot2);
                            const cell2 = row2.getCell(p + 3);
                            cell2.value = info2;
                            cell2.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

                            if (slot2.type === 'T1' || slot2.type === 'T2') {
                                const key = slot2.course.replace(/[^A-Za-z0-9]/g, '');
                                matchData.push({ tag: slot2.type, key: key, cell: cell2 });
                                if (slot2.type === 'T1') t1Count++;
                            } else {
                                lCount++;
                            }
                        }
                    }
                }
            }

            for (let c = 1; c <= 11; c++) {
                row1.getCell(c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                row2.getCell(c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }

            rowIndex += 2;
        });

        // Footers
        rowIndex++; 
        
        sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
        sheet.getCell(`A${rowIndex}`).value = 'To be Effective from 20.07.2026';
        sheet.getCell(`A${rowIndex}`).font = { bold: true };
        rowIndex++;

        sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
        sheet.getCell(`A${rowIndex}`).value = 'A minimum of 75% attendance is mandatory for being eligible to sit for the End-Semester Examination';
        sheet.getCell(`A${rowIndex}`).font = { bold: true };
        rowIndex++;

        sheet.mergeCells(`A${rowIndex}:K${rowIndex}`);
        sheet.getCell(`A${rowIndex}`).value = 'Students should target 100% attendance';
        sheet.getCell(`A${rowIndex}`).font = { bold: true };
        rowIndex += 2;

        sheet.getCell(`C${rowIndex}`).value = 'Member';
        sheet.getCell(`F${rowIndex}`).value = 'HOD';
        sheet.getCell(`J${rowIndex}`).value = 'Principal';
        sheet.getCell(`C${rowIndex}`).font = { bold: true };
        sheet.getCell(`F${rowIndex}`).font = { bold: true };
        sheet.getCell(`J${rowIndex}`).font = { bold: true };
        sheet.getCell(`C${rowIndex}`).alignment = { horizontal: 'center' };
        sheet.getCell(`F${rowIndex}`).alignment = { horizontal: 'center' };
        sheet.getCell(`J${rowIndex}`).alignment = { horizontal: 'right' };

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
                    const colorHex = COLORS[colorIndex % COLORS.length];
                    t1.cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colorHex } };
                    t2.cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colorHex } };
                    used.add(i);
                    used.add(t2Index);
                    colorIndex++;
                }
            }
        });
        
        sheet.getCell('I2').value = `L: ${lCount}  |  T1: ${t1Count}  |  Total Load: ${lCount + t1Count}`;
        sheet.getCell('I2').font = { bold: true, size: 10, italic: true };
        sheet.getCell('I2').alignment = { horizontal: 'right' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'Faculty_Routines.xlsx');
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
