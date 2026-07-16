import { GridState, FacultyData } from './constraintUtils';
import Papa from 'papaparse';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const DAY_MARKS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
export const TIME_LABELS = ['9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM'];

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

/* ========================================================================
   DEPT & COURSE VIEW — Excel export with merging + alternating colors
   Mirrors the AppScript generateDeptCourseMapping exactly
   ======================================================================== */
export async function exportDeptCourseCSV(grid: GridState) {
    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Dept-Course View');

    // Gather data
    const flatData: string[][] = [];
    DAYS.forEach(day => {
        const dayRows = grid[day] || [];
        dayRows.forEach(row => {
            row.slots.forEach((slot, idx) => {
                if (!slot || !slot.faculty) return;
                
                let rawStr = `${slot.type}/${slot.course}/${slot.dept}/${slot.room}`;
                flatData.push([
                    slot.dept || '',
                    slot.course || '',
                    slot.faculty,
                    day,
                    TIME_LABELS[idx],
                    slot.type,
                    slot.room || '',
                    rawStr
                ]);
            });
        });
    });

    // Sort by Department then Course
    flatData.sort((a, b) => {
        const deptA = a[0].toLowerCase(), deptB = b[0].toLowerCase();
        if (deptA < deptB) return -1;
        if (deptA > deptB) return 1;
        const courseA = a[1].toLowerCase(), courseB = b[1].toLowerCase();
        if (courseA < courseB) return -1;
        if (courseA > courseB) return 1;
        return 0;
    });

    const headers = ['Department', 'Course', 'Faculty', 'Day', 'Time Slot', 'Class Type', 'Room', 'Raw Detail String'];

    // Write header
    const headerRow = sheet.getRow(1);
    headerRow.values = headers;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= 8; c++) {
        headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A86E8' } };
        headerRow.getCell(c).border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    }

    // Write data with alternating dept colors
    let currentDept = '';
    let colorToggle = false;
    const color1 = 'FFFFFFFF'; // white
    const color2 = 'FFF1F8FF'; // light blue

    flatData.forEach((rowData, i) => {
        if (rowData[0] !== currentDept) {
            currentDept = rowData[0];
            colorToggle = !colorToggle;
        }
        const excelRow = sheet.getRow(i + 2);
        excelRow.values = rowData;
        const bgColor = colorToggle ? color1 : color2;
        for (let c = 1; c <= 8; c++) {
            excelRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            excelRow.getCell(c).border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
        }
    });

    // Merge Department column (Col 1)
    let startR = 2;
    for (let r = 2; r <= flatData.length + 2; r++) {
        const isEnd = r === flatData.length + 2;
        const currVal = isEnd ? null : flatData[r - 2][0];
        const prevVal = flatData[startR - 2][0];
        if (isEnd || currVal !== prevVal) {
            if (r - startR > 1) {
                sheet.mergeCells(startR, 1, r - 1, 1);
                sheet.getCell(startR, 1).alignment = { vertical: 'middle', horizontal: 'center' };
            }
            startR = r;
        }
    }

    // Merge Course column (Col 2) within same dept
    startR = 2;
    for (let r = 2; r <= flatData.length + 2; r++) {
        const isEnd = r === flatData.length + 2;
        const currKey = isEnd ? null : flatData[r - 2][0] + '|' + flatData[r - 2][1];
        const prevKey = flatData[startR - 2][0] + '|' + flatData[startR - 2][1];
        if (isEnd || currKey !== prevKey) {
            if (r - startR > 1) {
                sheet.mergeCells(startR, 2, r - 1, 2);
                sheet.getCell(startR, 2).alignment = { vertical: 'middle', horizontal: 'center' };
            }
            startR = r;
        }
    }

    // Auto-width columns
    sheet.columns = [
        { width: 16 }, { width: 16 }, { width: 10 }, { width: 14 },
        { width: 24 }, { width: 12 }, { width: 10 }, { width: 30 }
    ];

    // Freeze header
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), 'Dept_Course_View.xlsx');
}

/* ========================================================================
   LOAD MATRIX CSV — Matches Sheet2 of the AppScript fillLoadMatrix format exactly.
   
   Row 1: empty header row
   Row 2: empty
   Row 3: header → Col B = empty, Col C = empty, Col D = empty, Col E..AW = time slot labels for 45 slots
   Row 4..N: faculty rows → Col B = faculty code, Col E..AW = mapped load codes, Col AX..BG = stats
   ======================================================================== */
export async function exportLoadMatrixExcel(grid: GridState, faculties: FacultyData[], mappingRules: { startsWith: string, mapsTo: string }[]) {
    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Load Matrix');

    // Headers setup based on screenshot
    // Col 1: S.No (empty or index)
    // Col 2: Faculty Full Name
    // Col 3: (Abbrv)
    // Col 4: Designation
    // Col 5: Employee Code
    // Col 6-14: MONDAY (9 periods)
    // Col 15-23: TUESDAY
    // Col 24-32: WEDNESDAY
    // Col 33-41: THURSDAY
    // Col 42-50: FRIDAY

    // Row 1: FACULTY ENGAGEMENT OF MATHEMATICS FOR THE SESSION 2025-26 EVEN SEMESTER
    sheet.mergeCells('F1:AX1');
    sheet.getCell('F1').value = 'FACULTY ENGAGEMENT OF MATHEMATICS FOR THE SESSION 2025-26 EVEN SEMESTER';
    sheet.getCell('F1').font = { bold: true };
    sheet.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Empty
    
    // Row 3: Main Headers
    sheet.getCell('B3').value = 'Faculty Full Name';
    sheet.getCell('C3').value = '(Abbrv)';
    sheet.getCell('D3').value = 'Designation';
    sheet.getCell('E3').value = 'Employee Code';
    sheet.getRow(3).font = { bold: true };
    sheet.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' };

    const daysUpper = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    for (let d = 0; d < 5; d++) {
        const startCol = 6 + d * 9;
        const endCol = startCol + 8;
        sheet.mergeCells(3, startCol, 3, endCol);
        sheet.getCell(3, startCol).value = daysUpper[d];
        sheet.getCell(3, startCol).font = { bold: true };
        sheet.getCell(3, startCol).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Row 4: Period Numbers
    for (let i = 1; i <= 5; i++) {
        sheet.getCell(4, i).value = i === 1 ? '' : sheet.getCell(3, i).value;
    }
    for (let d = 0; d < 5; d++) {
        for (let p = 0; p < 9; p++) {
            const col = 6 + d * 9 + p;
            sheet.getCell(4, col).value = p + 1;
            sheet.getCell(4, col).font = { bold: true };
            sheet.getCell(4, col).alignment = { horizontal: 'center', vertical: 'middle' };
        }
    }

    // Borders for headers
    for (let r = 3; r <= 4; r++) {
        for (let c = 1; c <= 50; c++) {
            sheet.getCell(r, c).border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }
    }

    // Data Rows
    let rowIndex = 5;
    faculties.forEach((fac, idx) => {
        const row = sheet.getRow(rowIndex);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = fac.name || '';
        row.getCell(3).value = fac.code;
        row.getCell(4).value = fac.designation || '';
        row.getCell(5).value = fac.employeeCode || '';

        // Fill slots
        let slotIdx = 6;
        DAYS.forEach(day => {
            for (let p = 0; p < 9; p++) {
                const periodSlots = (grid[day] || []).map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                
                if (periodSlots.length > 0) {
                    const slot = periodSlots[0];
                    if (slot) {
                        let rawStr = `${slot.course}`;
                        if (slot.type === 'T1' || slot.type === 'T2') rawStr = `${slot.type}/${slot.course}`;
                        if (slot.type === 'P') rawStr = `P/${slot.course}`;

                        let mapped = '';
                        for (const rule of mappingRules) {
                            if (rawStr.startsWith(rule.startsWith) && rule.startsWith !== '') {
                                mapped = rule.mapsTo;
                                break;
                            }
                        }

                        // Use rawStr if no rule matched and default is blank, or use '1L' if default rule exists.
                        // Actually, if rules exist but no match, default is blank if we modify default rule assumption
                        if (!mapped) {
                            const hasDefaultRule = mappingRules.some(r => r.startsWith === '');
                            if (hasDefaultRule) {
                                mapped = mappingRules.find(r => r.startsWith === '')!.mapsTo;
                            }
                        }

                        row.getCell(slotIdx).value = mapped;
                        row.getCell(slotIdx).font = { bold: true };
                    }
                }
                row.getCell(slotIdx).alignment = { horizontal: 'center', vertical: 'middle' };
                slotIdx++;
            }
        });

        // Set borders for data row
        for (let c = 1; c <= 50; c++) {
            row.getCell(c).border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        }
        rowIndex++;
    });

    // Column Widths
    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 15;
    for (let c = 6; c <= 50; c++) {
        sheet.getColumn(c).width = 4;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), 'Load_Matrix.xlsx');
}

/* ========================================================================
   FACULTY EXCEL — One worksheet tab per faculty with exact template format,
   T1/T2 color highlighting, headers, footers, and stats.
   ======================================================================== */
export async function exportFacultyExcel(grid: GridState, faculties: FacultyData[]) {
    // Dynamic import — handle both ESM default and named exports
    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
    const workbook = new Workbook();
    
    // Pastel COLORS for T1/T2 pair highlighting
    const PAIR_COLORS = [
      "FFDAB9", "E6E6FA", "E0FFFF", "F0FFF0",
      "FFFACD", "F5DEB3", "D8BFD8", "F5F5DC"
    ];

    faculties.forEach(fac => {
        const sheet = workbook.addWorksheet(fac.code);

        // Column widths are computed dynamically after data is written (see below)
        // so we just initialise them here with a narrow default
        sheet.columns = [
            { width: 5 },  // A: DAY
            { width: 5 },  // B: Gr
            { width: 4 }, // C: P1
            { width: 4 }, // D: P2
            { width: 4 }, // E: P3
            { width: 4 }, // F: P4
            { width: 4 }, // G: P5
            { width: 4 }, // H: P6
            { width: 4 }, // I: P7
            { width: 4 }, // J: P8
            { width: 4 }, // K: P9
        ];

        // Row 1: Institution name + Faculty code
        sheet.mergeCells('A1:H1');
        sheet.getCell('A1').value = 'Heritage Institute of Technology';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        
        sheet.mergeCells('I1:K1');
        sheet.getCell('I1').value = 'Faculty: ' + fac.code;
        sheet.getCell('I1').font = { bold: true, size: 12 };
        sheet.getCell('I1').alignment = { horizontal: 'right' };

        // Row 2: TIME TABLE + stats placeholder
        sheet.mergeCells('A2:H2');
        sheet.getCell('A2').value = 'TIME TABLE';
        sheet.getCell('A2').font = { bold: true, size: 12 };
        sheet.getCell('A2').alignment = { horizontal: 'center' };
        sheet.mergeCells('I2:K2');

        // Row 3: B.Tech/M.Tech/MCA + SESSION
        sheet.mergeCells('A3:I3');
        sheet.getCell('A3').value = 'B.Tech/M.Tech/MCA';
        sheet.getCell('A3').font = { bold: true };
        sheet.mergeCells('J3:K3');
        sheet.getCell('J3').value = 'SESSION: 2025-26';
        sheet.getCell('J3').font = { bold: true };
        sheet.getCell('J3').alignment = { horizontal: 'right' };

        // Row 4: Time slot headers
        const headerRow = sheet.getRow(4);
        headerRow.values = ['DAY', '', ...TIME_LABELS];
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        for (let c = 1; c <= 11; c++) {
            headerRow.getCell(c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }

        let rowIndex = 5;
        const matchData: { tag: string; key: string; cell: any }[] = [];
        let lCount = 0;
        let t1Count = 0;

        DAYS.forEach((day, dIdx) => {
            const dayRows = grid[day] || [];
            
            const row1 = sheet.getRow(rowIndex);
            const row2 = sheet.getRow(rowIndex + 1);
            row1.height = 35;
            row2.height = 35;

            // Day label (merged vertically)
            row1.getCell(1).value = DAY_MARKS[dIdx].substring(0, 3);
            sheet.mergeCells(`A${rowIndex}:A${rowIndex + 1}`);
            sheet.getCell(`A${rowIndex}`).alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
            sheet.getCell(`A${rowIndex}`).font = { bold: true };

            // Group labels
            row1.getCell(2).value = 'Gr. 1';
            row1.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
            row1.getCell(2).font = { bold: true };
            row2.getCell(2).value = 'Gr. 2';
            row2.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
            row2.getCell(2).font = { bold: true };

            for (let p = 0; p < 9; p++) {
                const periodSlots = dayRows.map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                
                if (periodSlots.length > 0) {
                    // Gr. 1 slot
                    const slot1 = periodSlots[0];
                    if (slot1) {
                        const info1 = processInfo(slot1);
                        const cell1 = row1.getCell(p + 3);
                        cell1.value = info1;
                        cell1.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

                        if (slot1.type === 'T1' || slot1.type === 'T2') {
                            matchData.push({ tag: slot1.type, key: slot1.course.replace(/[^A-Za-z0-9]/g, ''), cell: cell1 });
                            if (slot1.type === 'T1') t1Count++;
                        } else {
                            lCount++;
                        }
                    }

                    // Gr. 2 slot
                    if (periodSlots.length > 1) {
                        const slot2 = periodSlots[1];
                        if (slot2) {
                            const info2 = processInfo(slot2);
                            const cell2 = row2.getCell(p + 3);
                            cell2.value = info2;
                            cell2.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

                            if (slot2.type === 'T1' || slot2.type === 'T2') {
                                matchData.push({ tag: slot2.type, key: slot2.course.replace(/[^A-Za-z0-9]/g, ''), cell: cell2 });
                                if (slot2.type === 'T1') t1Count++;
                            } else {
                                lCount++;
                            }
                        }
                    }
                }
            }

            // Borders for both rows
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

        // Signature line
        sheet.getCell(`C${rowIndex}`).value = 'Member';
        sheet.getCell(`F${rowIndex}`).value = 'HOD';
        sheet.getCell(`J${rowIndex}`).value = 'Principal';
        ['C', 'F', 'J'].forEach(col => {
            sheet.getCell(`${col}${rowIndex}`).font = { bold: true };
            sheet.getCell(`${col}${rowIndex}`).alignment = { horizontal: 'center' };
        });

        // T1/T2 pair color highlighting
        const used = new Set<number>();
        let colorIndex = 0;

        matchData.forEach((t1, i) => {
            if (t1.tag === 'T1' && !used.has(i)) {
                const t2Index = matchData.findIndex((t2, j) => 
                    j !== i && t2.tag === 'T2' && t1.key === t2.key && !used.has(j)
                );
                if (t2Index !== -1) {
                    const t2 = matchData[t2Index];
                    const colorHex = PAIR_COLORS[colorIndex % PAIR_COLORS.length];
                    t1.cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colorHex } };
                    t2.cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colorHex } };
                    
                    used.add(i);
                    used.add(t2Index);
                    colorIndex++;
                }
            }
        });

        // ── Dynamic column-width calculation ──────────────────────────────
        // Walk every data row (rows 5 onward) and measure the longest
        // line in each cell's text. We DO NOT include the header length,
        // so if a column has no classes, its max measured length is 0.
        const colMaxLen: number[] = new Array(12).fill(0);

        sheet.eachRow((row, rowNum) => {
            if (rowNum < 5 || rowNum > 14) return; // skip header rows and footer rows
            row.eachCell({ includeEmpty: false }, (cell, colNum) => {
                const val = cell.value;
                if (!val) return;
                const text = typeof val === 'string' ? val : String(val);
                // For wrapped text split on newline, use the longest line
                const maxLine = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
                colMaxLen[colNum] = Math.max(colMaxLen[colNum] || 0, maxLine);
            });
        });

        // Apply widths: add a small padding factor (×1.15 + 1)
        for (let c = 1; c <= 11; c++) {
            const measured = colMaxLen[c] ? colMaxLen[c] * 1.15 + 1 : 0;
            if (c === 1) {
                // DAY column — fixed narrow, text is rotated
                sheet.getColumn(c).width = 4.5;
            } else if (c === 2) {
                // Gr column
                sheet.getColumn(c).width = 5;
            } else {
                // Period columns: use measured width. If empty, squeeze to 9.0
                sheet.getColumn(c).width = measured > 0
                    ? Math.min(Math.max(measured, 7), 24)
                    : 9.0;
            }
        }
        
        // Stats in header row 2
        sheet.getCell('I2').value = `L: ${lCount}  |  T1: ${t1Count}  |  Total Load: ${lCount + t1Count}`;
        sheet.getCell('I2').font = { bold: true, size: 10, italic: true };
        sheet.getCell('I2').alignment = { horizontal: 'right' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), 'Faculty_Routines.xlsx');
}

export async function exportCodeResponsibilityExcel(codeResponsibilities: {course: string, dept: string, faculty: string}[], faculties: FacultyData[]) {
    const ExcelJS = await import('exceljs');
    const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Code Responsibility');

    // Title Row
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Code Responsibility';
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subtitle Row
    sheet.mergeCells('A2:C2');
    const subTitleCell = sheet.getCell('A2');
    subTitleCell.value = 'Odd Semester 2026-27';
    subTitleCell.font = { name: 'Calibri', size: 12, bold: true };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Header Row (Row 3)
    sheet.getRow(3).values = ['Faculty', 'Code', 'Stream(s)'];
    sheet.getRow(3).font = { name: 'Calibri', size: 11, bold: true };
    ['A3', 'B3', 'C3'].forEach(cell => {
        sheet.getCell(cell).alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getCell(cell).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Grouping logic
    const facultyMap = new Map<string, Map<string, string[]>>(); // Faculty -> Course -> Dept[]
    
    codeResponsibilities.forEach(cr => {
        if (!cr.faculty || !cr.course || !cr.dept) return;
        if (!facultyMap.has(cr.faculty)) facultyMap.set(cr.faculty, new Map());
        const courseMap = facultyMap.get(cr.faculty)!;
        if (!courseMap.has(cr.course)) courseMap.set(cr.course, []);
        if (!courseMap.get(cr.course)!.includes(cr.dept)) {
            courseMap.get(cr.course)!.push(cr.dept);
        }
    });

    let currentRow = 4;

    facultyMap.forEach((courseMap, facultyCode) => {
        const startRow = currentRow;
        let totalRowsForFaculty = 0;

        courseMap.forEach((depts, courseCode) => {
            const streamsStr = depts.join(', ');
            const row = sheet.getRow(currentRow);
            row.getCell(1).value = facultyCode; // Will merge later
            row.getCell(2).value = courseCode;
            row.getCell(3).value = streamsStr;
            
            [1, 2, 3].forEach(col => {
                row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(col).border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            
            currentRow++;
            totalRowsForFaculty++;
        });

        // Merge Faculty column
        if (totalRowsForFaculty > 1) {
            sheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
        }
    });

    // Set Column Widths
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 40;

    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(new Blob([buffer]), 'Code_Responsibility.xlsx');
}

/* ========================================================================
   UTILITIES
   ======================================================================== */
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

function saveBlob(blob: Blob, filename: string) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
