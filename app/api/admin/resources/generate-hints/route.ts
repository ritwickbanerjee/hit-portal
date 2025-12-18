import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { incrementUsage, getGlobalUsage } from '@/lib/gemini';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { questions } = body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ success: false, error: "No questions provided" }, { status: 400 });
        }

        // 1. Prepare Prompt
        const questionsText = questions.map((q: any, i: number) => `Q${i + 1}: ${q.text || q.content} (Topic: ${q.topic})`).join('\n\n');

        const prompt = `You are an expert academic tutor.
        
        Task: Generate specific, helpful hints for the following academic questions.
        
        Rules for Hints:
        1. **Quantity:** Generate strictly between 2 to 4 hints per question.
        2. **Conciseness:** Hints must be short, direct, and to the point. Avoid elaborate explanations.
        3. **Progression:** 
           - First hint: A gentle nudge (e.g., "Recall the formula for...").
           - Middle hint(s): Guide the step-by-step process.
           - Final hint: Be very specific about the final step but DO NOT reveal the final answer.
        4. **Formatting:** Use double backslashes (\\\\) for all LaTeX math.
        
        Output format: strict JSON array of objects with "id" and "hints" (array of strings).

INPUT QUESTIONS:
${questionsText}

RULES:
1. Output MUST be a valid JSON array.
2. Each item in the array must be an object with:
   - "id": The ID of the question (I will provide sequential logic, so map Q1 -> input[0].id, etc. actually wait, just return an array in the same order).
   - "hints": An array of strings (the hints).
3. Use LaTeX for math. STRICTLY usages double backslashes (\\\\) for all latex commands. Example: \\\\frac{a}{b}.
4. Do NOT output markdown code blocks. Just the raw JSON string.

Example Output:
[
  { "hints": ["Hint 1 for Q1", "Hint 2 for Q1"] },
  { "hints": ["Hint 1 for Q2"] }
]`;

        // 2. Call Gemini (Passive Tracking - Increment Usage)
        // Estimate tokens (rough calc: 1 char ~= 0.25 tokens -> 4 chars = 1 token + prompt overhead)
        const estimatedTokens = Math.ceil(prompt.length / 4) + 500;

        // 3. Generate Content with Fallback Strategy
        // Attempts: 2.5-flash (primary) -> 1.5-flash (fallback)
        // With exponential backoff for 503s

        let result: any = null;
        let retryCount = 0;
        const maxRetries = 3;

        // Models to try in order
        const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
        let modelIndex = 0;

        while (modelIndex < modelsToTry.length && !result) {
            const currentModelName = modelsToTry[modelIndex];
            const currentModel = genAI.getGenerativeModel({ model: currentModelName });

            try {
                console.log(`Attempting with model: ${currentModelName}`);
                result = await currentModel.generateContent(prompt);
                break; // Success
            } catch (error: any) {
                console.warn(`Model ${currentModelName} failed:`, error.message);

                // If it's a 503 (Overloaded) and we haven't exhausted retries for this model
                if ((error.message?.includes('503') || error.message?.includes('overloaded')) && retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retrying ${currentModelName} (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
                    continue; // Retry same model
                }

                // If not 503 or retries exhausted, move to next model
                retryCount = 0; // Reset retries for next model
                modelIndex++;
            }
        }

        if (!result) throw new Error('Failed to generate content: All models overloaded or unavailable.');

        const response = await result.response;
        let text = response.text();

        // Increment Global Usage
        await incrementUsage(estimatedTokens);

        // 3. Parse Response
        // Clean markdown
        if (text.startsWith('```json')) {
            text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const hintsArray = JSON.parse(text);

        // Map back to IDs
        if (!Array.isArray(hintsArray) || hintsArray.length !== questions.length) {
            throw new Error("AI response length mismatch or invalid format");
        }

        const mappedResults = hintsArray.map((item: any, index: number) => ({
            id: questions[index].id || questions[index]._id, // Handle both ID types
            hints: item.hints || []
        }));

        // Get updated stats
        const stats = await getGlobalUsage();

        return NextResponse.json({
            success: true,
            results: mappedResults,
            usage: stats
        });

    } catch (error: any) {
        console.error("Generate Hints Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to generate hints"
        }, { status: 500 });
    }
}
