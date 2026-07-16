import { TIME_LABELS, DAYS, DAY_MARKS, saveBlob } from './exportUtils';
import { GridState, FacultyData } from './constraintUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

const getDisplayName = (code: string) => code.toUpperCase() === 'NF' ? 'AR' : code;

function processInfo(slot: any) {
    if (!slot) return '';
    return `${slot.course}\n${slot.type} / ${slot.dept}\n${slot.room || 'TBA'}`;
}

export async function exportFacultyPDF(grid: GridState, faculties: FacultyData[], sessionYear: string = "2026-27") {
    const PAIR_COLORS = [
        [255, 218, 185], [230, 230, 250], [224, 255, 255], [240, 255, 240],
        [255, 250, 205], [245, 222, 179], [216, 191, 216], [245, 245, 220]
    ];

    const zip = new JSZip();

    for (let facIdx = 0; facIdx < faculties.length; facIdx++) {
        const fac = faculties[facIdx];
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        
        const dispName = getDisplayName(fac.code);

        // Headers
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Heritage Institute of Technology", doc.internal.pageSize.width / 2, 30, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text("TIME TABLE", doc.internal.pageSize.width / 2, 45, { align: 'center' });
        doc.text("Faculty: " + dispName, doc.internal.pageSize.width - 40, 45, { align: 'right' });
        
        doc.setFontSize(10);
        doc.text("B.Tech/M.Tech/MCA", 40, 60);
        doc.text("SESSION: " + sessionYear, doc.internal.pageSize.width - 40, 60, { align: 'right' });
        
        let t1Count = 0;
        let lCount = 0;

        const body: any[][] = [];
        const matchDataStore: any[] = []; 
        
        DAYS.forEach((day, dIdx) => {
            const dayRows = grid[day] || [];
            
            const r1: any[] = [{ content: DAY_MARKS[dIdx].substring(0, 3), styles: { valign: 'middle', halign: 'center' } }];
            
            for (let p = 0; p < 9; p++) {
                const periodSlots = dayRows.map(r => r.slots[p]).filter(s => s && s.faculty === fac.code);
                
                let cell1 = '';
                
                if (periodSlots.length > 0) {
                    const slot1 = periodSlots[0]; // just take first
                    if (slot1) {
                        cell1 = processInfo(slot1);
                        if (slot1.type === 'T1' || slot1.type === 'T2') {
                            matchDataStore.push({ rowIdx: body.length, colIdx: p + 1, tag: slot1.type, key: (slot1.course + slot1.dept).replace(/[^A-Za-z0-9]/g, '') });
                            if (slot1.type === 'T1') t1Count++;
                        } else {
                            lCount++;
                        }
                    }
                }
                
                r1.push(cell1);
            }
            body.push(r1);
        });
        
        doc.setFont("helvetica", "italic");
        doc.text(`L: ${lCount}  |  T1: ${t1Count}  |  Total Load: ${lCount + t1Count}`, doc.internal.pageSize.width - 40, 75, { align: 'right' });
        
        const capturedCoords: any[] = [];
        let colorCounter = 0;
        const groupColors: Record<string, number[]> = {};

        autoTable(doc, {
            startY: 85,
            head: [['DAY', ...TIME_LABELS]],
            body: body,
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center', valign: 'middle', cellPadding: 2, lineWidth: 0.5, lineColor: [0, 0, 0], minCellHeight: 35 },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 35, fontStyle: 'bold' }
            },
            willDrawCell: function (data) {
                if (data.section === 'body') {
                    let actualColIdx = data.column.index;

                    const matchIdx = matchDataStore.findIndex(m => m.rowIdx === data.row.index && m.colIdx === actualColIdx);
                    if (matchIdx !== -1) {
                        const m = matchDataStore[matchIdx];
                        if (!groupColors[m.key]) {
                            groupColors[m.key] = PAIR_COLORS[colorCounter % PAIR_COLORS.length];
                            colorCounter++;
                        }
                        data.cell.styles.fillColor = groupColors[m.key] as any;
                    }
                }
            },
            didDrawCell: function(data) {
                if (data.section === 'body') {
                    let actualColIdx = data.column.index;
                    const matchIdx = matchDataStore.findIndex(m => m.rowIdx === data.row.index && m.colIdx === actualColIdx);
                    if (matchIdx !== -1) {
                        capturedCoords.push({
                            ...matchDataStore[matchIdx],
                            x: data.cell.x,
                            y: data.cell.y,
                            w: data.cell.width,
                            h: data.cell.height,
                            page: doc.getCurrentPageInfo().pageNumber
                        });
                    }
                }
            }
        });

        // Draw Arrows
        const usedPairs = new Set();
        capturedCoords.forEach((t1, i) => {
            if (t1.tag === 'T1' && !usedPairs.has(i)) {
                const t2Idx = capturedCoords.findIndex((t2, j) => 
                    t2.tag === 'T2' && t2.key === t1.key && !usedPairs.has(j)
                );
                
                if (t2Idx !== -1) {
                    const t2 = capturedCoords[t2Idx];
                    usedPairs.add(i);
                    usedPairs.add(t2Idx);
                    
                    if (t1.page === t2.page) {
                        doc.setPage(t1.page);
                        
                        let startX = t2.x + t2.w / 2;
                        let endX = t1.x + t1.w / 2;
                        let startY = t2.y + t2.h / 2;
                        let endY = t1.y + t1.h / 2;

                        const margin = 5;

                        if (t1.colIdx > t2.colIdx) {
                            startX = t2.x + t2.w - margin;
                            endX = t1.x + margin;
                        } else if (t1.colIdx < t2.colIdx) {
                            startX = t2.x + margin;
                            endX = t1.x + t1.w - margin;
                        }

                        if (t1.rowIdx > t2.rowIdx) {
                            startY = t2.y + t2.h - margin;
                            endY = t1.y + margin;
                        } else if (t1.rowIdx < t2.rowIdx) {
                            startY = t2.y + margin;
                            endY = t1.y + t1.h - margin;
                        }
                        
                        doc.setDrawColor(255, 0, 0); // Red
                        doc.setLineWidth(1.5);
                        doc.line(startX, startY, endX, endY);
                        
                        // Arrow head
                        const angle = Math.atan2(endY - startY, endX - startX);
                        const headlen = 8;
                        doc.line(endX, endY, endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
                        doc.line(endX, endY, endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
                    }
                }
            }
        });

        // Footers
        const finalY = (doc as any).lastAutoTable.finalY + 30;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("To be Effective from 20.07.2026", 40, finalY);
        doc.text("A minimum of 75% attendance is mandatory for being eligible to sit for the End-Semester Examination", 40, finalY + 15);
        doc.text("Students should target 100% attendance", 40, finalY + 30);
        
        doc.text("Member", doc.internal.pageSize.width * 0.25, finalY + 70, { align: 'center' });
        doc.text("HOD", doc.internal.pageSize.width * 0.5, finalY + 70, { align: 'center' });
        doc.text("Principal", doc.internal.pageSize.width * 0.75, finalY + 70, { align: 'center' });
        
        const pdfData = doc.output('arraybuffer');
        const prefix = fac.seniority ? `${fac.seniority}-` : '';
        zip.file(`${prefix}${dispName}.pdf`, pdfData);
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveBlob(content, 'Faculty_Routines.zip');
}

export async function exportCodeResponsibilityPDF(codeResponsibilities: {course: string, dept: string, faculty: string}[], faculties: FacultyData[]) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    
    const facMap = new Map<string, FacultyData>();
    faculties.forEach(f => facMap.set(getDisplayName(f.code), f));

    const facultyMap = new Map<string, Map<string, string[]>>();
    codeResponsibilities.forEach(cr => {
        if (!cr.faculty || !cr.course || !cr.dept) return;
        const dispFac = getDisplayName(cr.faculty);
        if (!facultyMap.has(dispFac)) facultyMap.set(dispFac, new Map());
        const courseMap = facultyMap.get(dispFac)!;
        if (!courseMap.has(cr.course)) courseMap.set(cr.course, []);
        if (!courseMap.get(cr.course)!.includes(cr.dept)) {
            courseMap.get(cr.course)!.push(cr.dept);
        }
    });

    const rows: any[] = [];
    facultyMap.forEach((courseMap, facultyCode) => {
        courseMap.forEach((depts, courseCode) => {
            rows.push({ faculty: facultyCode, course: courseCode, depts });
        });
    });

    rows.sort((a, b) => {
        const sA = facMap.get(a.faculty)?.seniority ?? 999;
        const sB = facMap.get(b.faculty)?.seniority ?? 999;
        if (sA !== sB) return sA - sB;
        return a.course.localeCompare(b.course);
    });

    let lastFac = '';
    const tableBody = rows.map(r => {
        const displayFac = r.faculty === lastFac ? '' : r.faculty;
        lastFac = r.faculty;
        return [displayFac, r.course, r.depts.join(', ')];
    });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Code Responsibility", doc.internal.pageSize.width / 2, 40, { align: 'center' });
    doc.setFontSize(12);
    doc.text("Odd Semester 2026-27", doc.internal.pageSize.width / 2, 55, { align: 'center' });

    autoTable(doc, {
        startY: 70,
        head: [['Faculty', 'Code', 'Stream(s)']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 10, halign: 'center', valign: 'middle', cellPadding: 5 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save('Code_Responsibility.pdf');
}
