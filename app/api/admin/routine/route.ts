import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const facultyCode = searchParams.get('facultyCode');

    if (!facultyCode) {
        return NextResponse.json({ error: 'Faculty code is required' }, { status: 400 });
    }

    try {
        const spreadsheetId = '1YwzrTT_OpbPBq3aEncB7WhYYidryYDcEvpUSiWdjI-o';
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${facultyCode}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch from Google Sheets');
        }

        const csvText = await response.text();
        const parsedData = Papa.parse(csvText, { header: false }).data as string[][];

        if (parsedData.length < 4) {
             return NextResponse.json({ error: 'No routine data found for this faculty' }, { status: 404 });
        }

        // Header Row (Time Slots) is at index 2 usually
        const timeHeader = parsedData[2];
        const timeSlots = timeHeader.slice(2, 11).filter(t => t && t.trim() !== "");

        const routine: any = {};
        const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

        let currentDay = "";
        for (let i = 3; i < parsedData.length; i++) {
            const row = parsedData[i];
            if (!row || row.length < 2) continue;

            const dayMark = row[0]?.trim().toUpperCase();
            if (days.includes(dayMark)) {
                currentDay = dayMark;
                if (!routine[currentDay]) routine[currentDay] = [];
            }

            if (!currentDay) continue;

            const group = row[1]?.trim(); // Gr. 1 or Gr. 2
            
            // Extract slots
            for (let j = 2; j < 11; j++) {
                const cell = row[j]?.trim() || "";
                if (cell) {
                    const timeSlot = timeHeader[j];
                    routine[currentDay].push({
                        time: timeSlot,
                        group: group,
                        content: cell
                    });
                }
            }
        }

        return NextResponse.json({ 
            faculty: facultyCode,
            timeSlots,
            routine 
        });

    } catch (error: any) {
        console.error('Routine API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
