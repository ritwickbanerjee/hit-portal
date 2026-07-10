import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'edge';
// Edge runtime allows longer streaming without hitting the strict 10s/15s nodejs serverless limits on Hobby tier

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { existingHtml, instructions, targetSlide } = body;

        if (!existingHtml || !instructions) {
            return new Response(JSON.stringify({ error: 'Existing HTML and instructions are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const systemInstruction = `You are a STRICT, expert HTML presentation editor.
Your ONLY job is to modify the existing HTML exactly as instructed.

CRITICAL RULES:
1. Apply ONLY the requested changes. Do NOT rewrite unrelated parts of the presentation.
2. Return the COMPLETE modified HTML file (not just the changed parts).
3. Do NOT use requestFullscreen() or any fullscreen API — the presentation runs in an iframe.
4. Keep the output under 3000 lines.
5. Ensure no text or content overflows or gets cut off. Navigation buttons must not overlap content.
6. STRICT TEXT FORMATTING: Do NOT break lines artificially or use flex/grid for inline text that disrupts natural reading.
7. TARGET SLIDE: If the user specifies a particular slide number, you MUST ONLY change that slide. Do not touch the others.
8. Output ONLY the raw HTML code. No markdown code fences. No explanation text.`;

        const userPrompt = `TARGET SLIDE TO MODIFY: ${targetSlide || 'All'}
        
REQUESTED CHANGES:
${instructions}

EXISTING HTML CODE:
${existingHtml}

Now apply the requested changes strictly to the Target Slide, and return the complete modified HTML file. Output ONLY the HTML code.`;

        const estimatedTokens = Math.ceil((systemInstruction.length + userPrompt.length) / 4) + 2000;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemInstruction,
            generationConfig: {
                maxOutputTokens: 65536,
                temperature: 0.2, // Low temperature for strict adherence
            },
        });

        const result = await model.generateContentStream(userPrompt);

        // Usage tracking removed to prevent Edge runtime hanging

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (err: any) {
                    controller.enqueue(encoder.encode(`\n\n<!-- ERROR: ${err.message} -->`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error: any) {
        console.error('Magic PPT Refine Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Refinement failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
