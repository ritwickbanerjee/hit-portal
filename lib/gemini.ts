import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import connectDB from './db';
import ApiUsage from '../models/ApiUsage';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Constants - NO HARD LIMITS, Passive Tracking Only
const GLOBAL_TRACKER_ID = 'GLOBAL_TRACKER';

// AI Prompt for question extraction
const AI_PROMPT = `You are a Question Bank Assistant. Your task is to extract questions from the provided content and format them into a strict JSON array.

Rules:
1. Output MUST be a valid JSON array of objects.
2. Each question object must have: "text" (string), "type" (string: "broad", "mcq", or "blanks"), "topic" (string), "subtopic" (string).
3. Preserve LaTeX math notation using $ for inline and $$ for display math.
4. Do NOT add any explanation, markdown formatting, or extra text. Output ONLY the JSON array.
5. Ensure all special characters are properly escaped in JSON strings.

Example Output:
[
  {
    "text": "Find the rank of the matrix $ A = \\\\begin{pmatrix} 1 & 2 \\\\\\\\ 3 & 4 \\\\end{pmatrix} $",
    "type": "broad",
    "topic": "Matrix",
    "subtopic": "Rank"
  }
]`;

/**
 * Get current date in YYYY-MM-DD format (IST timezone)
 */
function getCurrentDateIST(): string {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

/**
 * Get current global usage stats (Passive Tracking)
 */
export async function getGlobalUsage(): Promise<{ usage: number; tokens: number; resetIn: string }> {
    await connectDB();

    const today = getCurrentDateIST();

    let usage = await ApiUsage.findOne({ userEmail: GLOBAL_TRACKER_ID, date: today });

    if (!usage) {
        usage = await ApiUsage.create({
            userEmail: GLOBAL_TRACKER_ID,
            date: today,
            requestCount: 0,
            tokensUsed: 0,
            lastReset: new Date()
        });
    }

    // Calculate time until reset (midnight IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const tomorrow = new Date(istNow);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const msUntilReset = tomorrow.getTime() - istNow.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    const resetIn = `${hoursUntilReset}h ${minutesUntilReset}m`;

    return {
        usage: usage.requestCount,
        tokens: usage.tokensUsed || 0,
        resetIn
    };
}

/**
 * Increment global usage counter
 */
export async function incrementUsage(tokensEstimate: number = 0): Promise<void> {
    await connectDB();

    const today = getCurrentDateIST();

    await ApiUsage.findOneAndUpdate(
        { userEmail: GLOBAL_TRACKER_ID, date: today },
        {
            $inc: { requestCount: 1, tokensUsed: tokensEstimate },
            $set: { lastReset: new Date() }
        },
        { upsert: true, new: true }
    );
}

/**
 * Convert file to text based on mime type
 */
async function fileToText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX file
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
    } else if (mimeType === 'application/pdf') {
        // For PDFs, we'll use Gemini's native PDF support
        return '';
    } else if (mimeType.startsWith('image/')) {
        // For images, we'll use Gemini's native image support
        return '';
    } else {
        throw new Error('Unsupported file type');
    }
}

/**
 * Extract questions from a file using Gemini API
 */
export async function extractQuestionsFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    onProgress?: (stage: string, progress: number) => void
): Promise<any[]> {
    try {
        onProgress?.('initializing', 10);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        onProgress?.('processing', 30);

        let result;

        if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
            // Use Gemini's multimodal capability for PDFs and images
            const imagePart = {
                inlineData: {
                    data: fileBuffer.toString('base64'),
                    mimeType: mimeType
                }
            };

            onProgress?.('analyzing', 50);

            result = await model.generateContent([AI_PROMPT, imagePart]);
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Extract text from DOCX first
            const text = await fileToText(fileBuffer, mimeType);

            onProgress?.('analyzing', 50);

            result = await model.generateContent([AI_PROMPT, text]);
        } else {
            throw new Error('Unsupported file type: ' + mimeType);
        }

        onProgress?.('extracting', 70);

        const response = await result.response;
        const textResponse = response.text();

        onProgress?.('parsing', 85);

        // Clean up the response - remove markdown code blocks if present
        let jsonText = textResponse.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Parse JSON
        const questions = JSON.parse(jsonText);

        onProgress?.('validating', 95);

        // Validate and normalize questions
        if (!Array.isArray(questions)) {
            throw new Error('Response is not an array');
        }

        const validated = questions.map((q: any) => {
            if (!q.text || !q.type || !q.topic || !q.subtopic) {
                throw new Error('Question missing required fields: text, type, topic, or subtopic');
            }

            return {
                text: q.text,
                type: q.type,
                topic: q.topic.charAt(0).toUpperCase() + q.topic.slice(1),
                subtopic: q.subtopic.charAt(0).toUpperCase() + q.subtopic.slice(1),
                id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
        });

        onProgress?.('complete', 100);

        return validated;

    } catch (error: any) {
        console.error('Gemini extraction error:', error);

        // Provide helpful, user-friendly error messages
        if (error.message?.includes('JSON') || error.message?.includes('parse')) {
            throw new Error('Failed to parse AI response. The document may be too complex, unclear, or contain non-standard formatting. Try: (1) Upload a smaller/clearer file, (2) Split into multiple files, or (3) Try again.');
        } else if (error.message?.includes('QUOTA_EXCEEDED')) {
            throw new Error('Daily API limit reached. Use the manual entry method below or wait for quota reset.');
        } else if (error.message?.includes('RATE_LIMIT')) {
            throw new Error('Too many requests. Please wait 1-2 minutes and try again.');
        } else if (error.message?.includes('413') || error.message?.includes('too large') || error.message?.includes('FILE_TOO_LARGE')) {
            throw new Error('File too large. Limits: PDFs under 6MB, Images under 2.5MB, DOCX under 10MB per user. Try compressing or splitting your file.');
        } else if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
            throw new Error('Request timed out. The file may be too large or complex. Try a smaller/simpler document.');
        } else {
            throw new Error(`Extraction failed: ${error.message}. Try uploading a clearer document or smaller file, or try again.`);
        }
    }
}

/**
 * Auto-debug and fix common JSON issues
 */
export async function autoDebugJSON(invalidJSON: string): Promise<{ fixed: boolean; json?: any; errors: string[] }> {
    const errors: string[] = [];
    let fixed = false;
    let result = null;

    // Try to fix common issues
    let jsonText = invalidJSON.trim();

    // Remove markdown code blocks
    if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        errors.push('Removed markdown code blocks');
    }

    // Try to parse
    try {
        result = JSON.parse(jsonText);
        fixed = true;
    } catch (e: any) {
        errors.push(`JSON Parse Error: ${e.message}`);

        // Try fixing common issues
        // 1. Unescaped quotes
        try {
            const escaped = jsonText.replace(/(?<!\\)"/g, '\\"');
            result = JSON.parse(escaped);
            fixed = true;
            errors.push('Fixed unescaped quotes');
        } catch (e2) {
            // 2. Missing commas
            try {
                const withCommas = jsonText.replace(/}\s*{/g, '},{');
                result = JSON.parse(withCommas);
                fixed = true;
                errors.push('Added missing commas between objects');
            } catch (e3) {
                errors.push('Could not auto-fix JSON. Manual editing required.');
            }
        }
    }

    // Validate structure
    if (fixed && result) {
        if (!Array.isArray(result)) {
            errors.push('Warning: Result is not an array');
            result = [result];
        }

        // Check for missing fields
        result.forEach((item: any, index: number) => {
            if (!item.text) errors.push(`Item ${index + 1}: missing 'text' field`);
            if (!item.type) errors.push(`Item ${index + 1}: missing 'type' field`);
            if (!item.topic) errors.push(`Item ${index + 1}: missing 'topic' field`);
            if (!item.subtopic) errors.push(`Item ${index + 1}: missing 'subtopic' field`);
        });
    }

    return { fixed, json: result, errors };
}
