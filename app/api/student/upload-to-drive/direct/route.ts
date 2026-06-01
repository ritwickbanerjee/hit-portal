import { NextResponse } from 'next/server';
// Next.js body parser size limit needs to be increased for direct uploads
export const maxDuration = 60; // Set timeout to 60s
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { scriptUrl, fileName, folderPath, fileData } = await req.json();

        if (!scriptUrl || !fileName || !folderPath || !fileData) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Upload to Google Drive via Apps Script
        const gasResponse = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData, fileName, folderPath }),
            redirect: 'follow',
        });

        const gasText = await gasResponse.text();

        // Check if we got HTML instead of JSON (permission error)
        if (gasText.includes('<!DOCTYPE html>') || gasText.includes('<html') || gasResponse.status === 401 || gasResponse.status === 403) {
            console.error('Received HTML/Permission error instead of JSON from Google Script');
            console.error('Script URL:', scriptUrl);
            return NextResponse.json({
                error: 'Google Script Permission Error',
                message: 'The faculty\'s Google Drive upload script is not properly configured. Please deploy the Google Apps Script with "Execute as: Me" and "Who has access: Anyone" settings.',
                details: 'Received permission error or HTML page instead of JSON response'
            }, { status: 502 });
        }

        let gasResult;
        try {
            gasResult = JSON.parse(gasText);
        } catch {
            console.error('GAS non-JSON response:', gasText.substring(0, 500));
            return NextResponse.json({
                error: 'Invalid response from Google Apps Script',
                details: gasText.substring(0, 200)
            }, { status: 502 });
        }

        if (gasResult.status !== 'success' || !gasResult.driveLink) {
            return NextResponse.json({
                error: gasResult.message || gasResult.error || 'Drive upload failed',
                gasResult
            }, { status: 502 });
        }

        let pageCount = 0;

        return NextResponse.json({
            status: 'success',
            driveLink: gasResult.driveLink,
            message: 'File uploaded successfully',
            pageCount
        });

    } catch (error: any) {
        console.error('Direct upload error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}
