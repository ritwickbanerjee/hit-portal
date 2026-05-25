import jsPDF, { GState } from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────
interface StudentInfo {
    name: string;
    roll: string;
    year: string;
    department: string;
    course_code: string;
}

interface AssignmentEntry {
    _id: string;
    title: string;
    type: string;
    createdAt: string;
    deadline: string;
    facultyName?: string;
    submitted: boolean;
    submittedAt?: string | null;
    questions: { text: string }[];
}

export interface TopSheetData {
    student: StudentInfo;
    assignments: AssignmentEntry[];
    facultyName?: string; // selected faculty (injected by caller)
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtDatetime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
}

// ─── Latex API Helpers ───────────────────────────────────────────────────

function formatMarkdownMathToLatex(text: string, qIndex: number) {
    let out = '';
    // Split by $ or $$
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
    
    for (let p of parts) {
        if (!p) continue;
        if (p.startsWith('$')) {
            // Math block: preserve exactly
            out += p;
        } else {
            // Text block: escape special LaTeX characters that break text mode
            let t = p;
            t = t.replace(/%/g, '\\%');
            t = t.replace(/#/g, '\\#');
            t = t.replace(/&/g, '\\&');
            t = t.replace(/(?<!\\)_/g, '\\_'); // escape unescaped underscores
            // Convert markdown bold/italic
            t = t.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');
            t = t.replace(/\*(.*?)\*/g, '\\textit{$1}');
            out += t;
        }
    }
    
    // Wrap in parbox for automatic word wrapping to fit the PDF content width (17cm)
    return `\\parbox{17cm}{\\textbf{Q${qIndex + 1}.} ${out}}`;
}

async function fetchCodecogsImage(latex: string): Promise<{ dataUrl: string, width: number, height: number }> {
    const url = `https://latex.codecogs.com/png.image?\\dpi{300}\\bg{white}${encodeURIComponent(latex)}`;
    
    // Fetch via standard JS fetch to avoid canvas CORS taint issues
    const res = await fetch(url);
    if (!res.ok) throw new Error('Codecogs API failed');
    const blob = await res.blob();
    
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ dataUrl, width: img.width, height: img.height });
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// ─── Watermark: draw scattered math symbols ────────────────────────────────
function drawWatermarks(doc: jsPDF, pageWidth: number, pageHeight: number) {
    const symbols = [
        '∫', '∑', '∞', '∂', 'π', '√', '∇', 'λ', 'Δ',
        '∈', '⊕', '≈', '∮', '⊗', '∏', 'θ', 'Ω', 'α', 'β',
    ];

    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.045 }));
    doc.setTextColor(30, 90, 60);
    doc.setFontSize(20);

    const cols = 8;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const sym = symbols[(r * cols + c) % symbols.length];
            const x = 8 + c * (pageWidth / cols);
            const y = 10 + r * (pageHeight / rows);
            doc.text(sym, x, y);
        }
    }
    doc.restoreGraphicsState();
}

// ─── Diagonal "HERITAGE INSTITUTE" watermark text ─────────────────────────
function drawDiagonalWatermark(doc: jsPDF, pageWidth: number, pageHeight: number) {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.04 }));
    doc.setTextColor(0, 80, 50);
    doc.setFontSize(26);

    const step = 60;
    for (let y = 20; y < pageHeight; y += step) {
        for (let x = -20; x < pageWidth + 20; x += 110) {
            doc.text('HIT · HERITAGE', x, y, { angle: 30 });
        }
    }
    doc.restoreGraphicsState();
}

// ─── Main generator ────────────────────────────────────────────────────────
export async function generateTopSheet(data: TopSheetData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const ML = 18; // margin left
    const MR = pageW - 18; // margin right
    const CW = MR - ML; // content width

    // ── Palette ──
    const DARK_GREEN = [10, 90, 60] as [number, number, number];
    const MID_GREEN = [20, 140, 90] as [number, number, number];
    const LIGHT_TEAL = [0, 180, 140] as [number, number, number];
    const GREY_TEXT = [80, 80, 80] as [number, number, number];
    const LIGHT_BG = [235, 248, 244] as [number, number, number];

    // ─── PAGE 1 WATERMARKS ─────────────────────────────────────────────────
    drawWatermarks(doc, pageW, pageH);
    drawDiagonalWatermark(doc, pageW, pageH);

    // ─── TOP DECORATIVE BAR (no address line) ─────────────────────────────
    doc.setFillColor(...DARK_GREEN);
    doc.rect(0, 0, pageW, 16, 'F');
    doc.setFillColor(...MID_GREEN);
    doc.rect(0, 16, pageW, 2, 'F');
    doc.setFillColor(...LIGHT_TEAL);
    doc.rect(0, 18, pageW, 0.6, 'F');

    // Institution name only
    doc.setFont('times', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('HERITAGE INSTITUTE OF TECHNOLOGY', pageW / 2, 10.5, { align: 'center' });

    let cy = 26; // current Y cursor

    // ─── ASSIGNMENT TOP SHEET label ───────────────────────────────────────
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(11);
    doc.setTextColor(...DARK_GREEN);
    doc.text('ASSIGNMENT TOP SHEET', pageW / 2, cy, { align: 'center' });
    cy += 1.5;

    // thin underline
    doc.setDrawColor(...MID_GREEN);
    doc.setLineWidth(0.35);
    doc.line(ML + CW * 0.25, cy + 1, MR - CW * 0.25, cy + 1);
    cy += 5;

    // ─── STUDENT DETAILS BOX ─────────────────────────────────────────────
    const boxH = data.facultyName ? 42 : 36;
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...MID_GREEN);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, cy, CW, boxH, 2, 2, 'FD');
    cy += 4;

    const colA = ML + 4;
    const colB = ML + CW / 2 + 2;
    const rowH = 5;

    const labelStyle = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY_TEXT);
    };
    const valueStyle = () => {
        doc.setFont('times', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 15, 15);
    };

    // Row 1: Name | Roll
    labelStyle(); doc.text('STUDENT NAME', colA, cy);
    labelStyle(); doc.text('ROLL NUMBER', colB, cy);
    cy += 3;
    valueStyle(); doc.text(data.student.name, colA, cy);
    valueStyle(); doc.text(data.student.roll, colB, cy);
    cy += rowH;

    // Row 2: Department | Year + Course
    labelStyle(); doc.text('DEPARTMENT', colA, cy);
    labelStyle(); doc.text('YEAR & COURSE CODE', colB, cy);
    cy += 3;
    valueStyle(); doc.text(data.student.department, colA, cy);
    valueStyle(); doc.text(`${data.student.year}  ·  ${data.student.course_code}`, colB, cy);
    cy += rowH;

    // Row 3 (optional): Faculty Name
    if (data.facultyName) {
        labelStyle(); doc.text('FACULTY', colA, cy);
        cy += 3;
        valueStyle(); doc.text(data.facultyName, colA, cy);
        cy += rowH;
    }

    // Row 4: Attendance & Signatures
    cy += 2;
    doc.setDrawColor(200, 215, 210);
    doc.setLineWidth(0.2);
    doc.line(ML + 2, cy, MR - 2, cy); // inner divider
    cy += 4.5;
    
    labelStyle(); doc.text('ATTENDANCE', colA, cy);
    labelStyle(); doc.text('STUDENT SIGNATURE', colA + CW * 0.35, cy);
    labelStyle(); doc.text('FACULTY SIGNATURE', colB + CW * 0.15, cy);
    cy += 4;
    valueStyle();
    if (data.student.attendancePercent !== undefined) {
        const pct = data.student.attendancePercent;
        if (pct >= 75) doc.setTextColor(0, 130, 80);
        else if (pct >= 60) doc.setTextColor(180, 120, 0);
        else doc.setTextColor(200, 40, 40);
        doc.text(`${pct}%`, colA, cy);
    } else {
        doc.setTextColor(15, 15, 15);
        doc.text('—', colA, cy);
    }
    
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(colA + CW * 0.35, cy, colA + CW * 0.35 + 32, cy);
    doc.line(colB + CW * 0.15, cy, colB + CW * 0.15 + 32, cy);
    cy += rowH;

    cy += 4; // gap between box and table

    // ─── ASSIGNMENTS TABLE ────────────────────────────────────────────────
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK_GREEN);
    doc.text('ASSIGNMENT RECORD', ML, cy);
    cy += 5; // increased spacing to avoid overlap

    // Table header
    const colWidths = [72, 37, 42, 22]; // title, deployed, submitted, status
    const tableX = ML;
    const headerH = 5.5;

    doc.setFillColor(...DARK_GREEN);
    doc.rect(tableX, cy, CW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let cx = tableX + 2;
    const headers = ['Assignment Title', 'Assigned On', 'Submitted On', 'Status'];
    headers.forEach((h, i) => {
        doc.text(h, cx, cy + 3.8);
        cx += colWidths[i];
    });
    cy += headerH;

    // Table rows
    const rowHt = 5.5;
    data.assignments.forEach((a, idx) => {
        // Page break check for table rows
        if (cy > pageH - 20) {
            doc.addPage();
            drawWatermarks(doc, pageW, pageH);
            drawDiagonalWatermark(doc, pageW, pageH);
            cy = 20;
        }

        const bg = idx % 2 === 0 ? [255, 255, 255] : [242, 252, 248];
        doc.setFillColor(...(bg as [number, number, number]));
        doc.setDrawColor(210, 230, 225);
        doc.setLineWidth(0.2);

        const titleLines = doc.splitTextToSize(a.title, colWidths[0] - 3);
        const rowHeight = Math.max(rowHt, titleLines.length * 3.5 + 2);

        doc.rect(tableX, cy, CW, rowHeight, 'FD');

        doc.setFont('times', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 30, 30);

        let rx = tableX + 2;
        // Title
        doc.text(titleLines, rx, cy + 3.5);
        rx += colWidths[0];
        // Deployed
        doc.text(fmtDatetime(a.createdAt), rx, cy + 3.5, { maxWidth: colWidths[1] - 2 });
        rx += colWidths[1];
        // Submitted
        doc.text(a.submitted ? fmtDatetime(a.submittedAt) : '—', rx, cy + 3.5, { maxWidth: colWidths[2] - 2 });
        rx += colWidths[2];
        // Status
        if (a.submitted) {
            doc.setTextColor(0, 130, 80);
            doc.setFont('helvetica', 'bold');
            doc.text('Submitted', rx, cy + 3.5);
        } else if (new Date(a.deadline) < new Date()) {
            doc.setTextColor(180, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text('Missed', rx, cy + 3.5);
        } else {
            doc.setTextColor(180, 120, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Pending', rx, cy + 3.5);
        }
        doc.setTextColor(30, 30, 30);
        doc.setFont('times', 'normal');

        cy += rowHeight;
    });

    cy += 4;

    // ─── HORIZONTAL DIVIDER ───────────────────────────────────────────────
    if (cy > pageH - 30) {
        doc.addPage();
        drawWatermarks(doc, pageW, pageH);
        drawDiagonalWatermark(doc, pageW, pageH);
        cy = 20;
    }

    doc.setDrawColor(...DARK_GREEN);
    doc.setLineWidth(0.6);
    doc.line(ML, cy, MR, cy);

    // Decorative dots on the line
    doc.setFillColor(...MID_GREEN);
    [ML + 10, pageW / 2, MR - 10].forEach(x => doc.circle(x, cy, 1, 'F'));

    cy += 5;

    // ─── SECTION: QUESTIONS PER ASSIGNMENT ────────────────────────────────

    const assignmentsWithQuestions = data.assignments.filter(a => a.questions.length > 0);

    for (const a of assignmentsWithQuestions) {
        // Check if we need a new page
        if (cy > pageH - 35) {
            doc.addPage();
            drawWatermarks(doc, pageW, pageH);
            drawDiagonalWatermark(doc, pageW, pageH);
            cy = 20;
        }

        // Assignment title header
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(...MID_GREEN);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, cy, CW, 7, 1.5, 1.5, 'FD');
        doc.setFont('times', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...DARK_GREEN);
        doc.text(`${a.title}`, ML + 3, cy + 4.5);
        doc.setFont('times', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...GREY_TEXT);
        doc.text(`Assigned: ${fmtDatetime(a.createdAt)}`, MR - 2, cy + 4.5, { align: 'right' });
        cy += 10;

        // Questions — rendered via Codecogs LaTeX API
        for (let qi = 0; qi < a.questions.length; qi++) {
            const q = a.questions[qi];
            if (cy > pageH - 20) {
                doc.addPage();
                drawWatermarks(doc, pageW, pageH);
                drawDiagonalWatermark(doc, pageW, pageH);
                cy = 20;
            }

            try {
                const latexCode = formatMarkdownMathToLatex(q.text, qi);
                const { dataUrl, width, height } = await fetchCodecogsImage(latexCode);
                
                // Convert 300 DPI pixels to mm for perfect true-to-size font scaling
                const scale = 25.4 / 300;
                let imgW = width * scale;
                let imgH = height * scale;

                // Cap width just in case the equation itself overflows 17cm
                if (imgW > CW - 8) {
                    const ratio = (CW - 8) / imgW;
                    imgW = CW - 8;
                    imgH = imgH * ratio;
                }

                // Check page break again if the image is too tall
                if (cy + imgH > pageH - 10) {
                    doc.addPage();
                    drawWatermarks(doc, pageW, pageH);
                    drawDiagonalWatermark(doc, pageW, pageH);
                    cy = 20;
                }

                doc.addImage(dataUrl, 'PNG', ML + 4, cy, imgW, imgH);
                cy += imgH + 2;

            } catch (err) {
                // Fallback if API fails
                doc.setFont('times', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(200, 40, 40);
                const qLines = doc.splitTextToSize(`Q${qi + 1}. [Math Rendering Failed] ${q.text}`, CW - 14);
                const qH = qLines.length * 3.5 + 2;
                doc.text(qLines, ML + 8, cy + 3.5);
                cy += qH + 1;
            }
        }
        cy += 3;
    }

    if (assignmentsWithQuestions.length === 0) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...GREY_TEXT);
        doc.text('No question sets available for this course.', ML, cy);
        cy += 8;
    }

    // ─── FOOTER ON ALL PAGES ──────────────────────────────────────────────
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const ph = doc.internal.pageSize.getHeight();
        const pw = doc.internal.pageSize.getWidth();

        // Footer bar
        doc.setFillColor(...DARK_GREEN);
        doc.rect(0, ph - 10, pw, 10, 'F');
        doc.setFillColor(...MID_GREEN);
        doc.rect(0, ph - 10.8, pw, 0.8, 'F');

        doc.setFont('times', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(200, 245, 225);
        doc.text(
            `Heritage Institute of Technology  |  Assignment Top Sheet  |  Generated: ${fmtDatetime(new Date().toISOString())}`,
            pw / 2, ph - 5.5, { align: 'center' }
        );
        doc.text(`Page ${p} of ${totalPages}`, pw - 16, ph - 5.5, { align: 'right' });
    }

    // ─── Save ─────────────────────────────────────────────────────────────
    const facultySuffix = data.facultyName ? `_${data.facultyName.replace(/\s+/g, '')}` : '';
    const fileName = `TopSheet_${data.student.roll}_${data.student.course_code}${facultySuffix}.pdf`;
    doc.save(fileName);
}
