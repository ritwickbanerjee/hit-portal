import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function test() {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            maxOutputTokens: 65536,
            temperature: 0.7,
        },
    });

    const prompt = `Write a long HTML presentation about Matrix Multiplication. At least 500 lines.`;
    
    try {
        console.log("Starting stream...");
        const result = await model.generateContentStream(prompt);
        let fullText = '';
        for await (const chunk of result.stream) {
            fullText += chunk.text();
            console.log("Got chunk of length:", chunk.text().length);
        }
        console.log("Stream finished. Total length:", fullText.length);
    } catch (e) {
        console.error("Stream error:", e);
    }
}

test();
