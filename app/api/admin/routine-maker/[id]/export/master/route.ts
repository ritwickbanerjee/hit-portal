import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Routine from '@/models/Routine';
import Papa from 'papaparse';

export const runtime = 'nodejs';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MARKS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const TIME_LABELS = ['9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '12:00 PM - 1:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM', '4:00 PM - 5:00 PM', '5:00 PM - 6:00 PM'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await connectDB();
        const { id } = await params;
        const routine = await Routine.findById(id);
        
        if (!routine) {
            return new NextResponse('Routine not found', { status: 404 });
        }

        const grid = routine.grid || {};
        const rows: string[][] = [];
        rows.push([' Routine Individual', ...TIME_LABELS]);

        DAYS.forEach((day, dIdx) => {
            const dayRows = grid[day] || [];
            if (dayRows.length === 0) return;
            
            let isFirstRowForDay = true;
            dayRows.forEach((row: any) => {
                const facRow = Array(10).fill('');
                const detRow = Array(10).fill('');
                
                if (isFirstRowForDay) {
                    facRow[0] = DAY_MARKS[dIdx];
                    isFirstRowForDay = false;
                }

                let hasData = false;
                row.slots.forEach((slot: any, pIdx: number) => {
                    if (slot && slot.faculty) {
                        facRow[pIdx + 1] = slot.faculty;
                        let rawStr = '';
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

        const csvContent = Papa.unparse(rows);
        
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="Master_Routine.csv"',
                'Access-Control-Allow-Origin': '*' // Allow Apps Script to fetch it
            }
        });
    } catch (error: any) {
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}
