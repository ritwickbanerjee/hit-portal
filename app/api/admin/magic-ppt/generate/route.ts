import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const runtime = 'edge';
// Edge runtime allows longer streaming without hitting the strict 10s/15s nodejs serverless limits on Hobby tier

interface FormData {
    topicName: string;
    targetAudience: string;
    presentationPurpose: string;
    bgColorScheme: string;
    customBgColor: string;
    colorTone: string;
    accentColor: string;
    fontStyle: string;
    keyConcepts: string;
    specificDetails: string;
    sequenceScreenplay: string;
    slideCount: number;
    animationLevel: string;
    interactiveElements: string[];
    objectRepresentation: string;
    practiceQuestions: string;
    questionSlideStyle: string;
    additionalInstructions: string;
}

function buildColorPalette(form: FormData): string {
    const bgMap: Record<string, string> = {
        'Pure Black': '#000000',
        'Dark Gray': '#0a0a0a',
        'Deep Navy': '#0a0e1a',
    };
    const bg = form.bgColorScheme === 'Custom' ? (form.customBgColor || '#000000') : (bgMap[form.bgColorScheme] || '#000000');
    const accent = form.accentColor || '#5ba3a0';

    if (form.colorTone === 'Broadcast-Safe Muted') {
        return `
:root {
    --bg: ${bg};
    --surface: #111111;
    --surface2: #1a1a1a;
    --border: #2a2a2a;
    --text: #d4d4d4;
    --dim: #5a5a5a;
    --accent: ${accent};
    --gold: #c8a84b;
    --green: #5a8f5a;
    --red: #a85050;
    --purple: #7a68a0;
    --orange: #b07840;
    --blue: #4878a0;
    --obj-a: ${accent};
    --obj-b: #c8a84b;
    --obj-c: #a85050;
    --obj-d: #5a8f5a;
}`;
    } else if (form.colorTone === 'Vibrant') {
        return `
:root {
    --bg: ${bg};
    --surface: #111111;
    --surface2: #1a1a1a;
    --border: #2a2a2a;
    --text: #e0e0e0;
    --dim: #666666;
    --accent: ${accent};
    --gold: #f0c040;
    --green: #40c057;
    --red: #e03131;
    --purple: #845ef7;
    --orange: #f76707;
    --blue: #339af0;
    --obj-a: ${accent};
    --obj-b: #f0c040;
    --obj-c: #e03131;
    --obj-d: #40c057;
}`;
    } else if (form.colorTone === 'Monochrome') {
        return `
:root {
    --bg: ${bg};
    --surface: #111111;
    --surface2: #1a1a1a;
    --border: #2a2a2a;
    --text: #d4d4d4;
    --dim: #5a5a5a;
    --accent: ${accent};
    --gold: #b0b0b0;
    --green: #909090;
    --red: #c0c0c0;
    --purple: #a0a0a0;
    --orange: #d0d0d0;
    --blue: #808080;
    --obj-a: ${accent};
    --obj-b: #b0b0b0;
    --obj-c: #c0c0c0;
    --obj-d: #909090;
}`;
    }
    // Default / Pastel
    return `
:root {
    --bg: ${bg};
    --surface: #111111;
    --surface2: #1a1a1a;
    --border: #2a2a2a;
    --text: #d4d4d4;
    --dim: #5a5a5a;
    --accent: ${accent};
    --gold: #dfc88a;
    --green: #8fbf8f;
    --red: #d09090;
    --purple: #a898c8;
    --orange: #d0a070;
    --blue: #88a8c8;
    --obj-a: ${accent};
    --obj-b: #dfc88a;
    --obj-c: #d09090;
    --obj-d: #8fbf8f;
}`;
}

function buildMasterPrompt(form: FormData): string {
    const colorPalette = buildColorPalette(form);
    const font = form.fontStyle === 'Custom' ? 'Poppins' : form.fontStyle;
    const fontUrl = {
        'Poppins': 'Poppins:wght@300;500;700',
        'Inter': 'Inter:wght@300;500;700',
        'Roboto': 'Roboto:wght@300;500;700',
        'Outfit': 'Outfit:wght@300;500;700',
    }[font] || 'Poppins:wght@300;500;700';

    const animDesc: Record<string, string> = {
        'Minimal': 'Use subtle fade-in animations only. Keep transitions clean and simple. Avoid complex moving parts.',
        'Moderate': 'Use purposeful animations: fade-ins, slide-ins, scale transitions. Each animation should build understanding step by step. Timing: 350-600ms.',
        'Maximum': 'Use rich, elaborate animations everywhere: staggered reveals, arc movements, merge animations, ripple effects, counting machines, slot-filling animations, pulse effects, hover interactions. Every concept should be animated to build intuition. Make it visually spectacular.',
    };

    const interactiveDesc = form.interactiveElements.length > 0
        ? `Include these interactive elements: ${form.interactiveElements.join(', ')}. Make all buttons touch-friendly (min 60px height).`
        : 'Include clickable "Reveal" buttons for key formula/concept revelations. Make all buttons touch-friendly (min 60px height).';

    const objectDesc: Record<string, string> = {
        'Colored tiles': 'Every "object" is a colored square tile (72px) with a bold letter, rounded corners (12px), 2px border. Use .obj-A, .obj-B, .obj-C, .obj-D classes with the 4 CSS variable colors.',
        'Circles': 'Every "object" is a colored circle (72px diameter) with a bold letter centered inside. Use the 4 CSS variable colors for distinct object types.',
        'Cards': 'Every "object" is a card with subtle shadow, rounded corners, padding, and a bold label. Use the 4 CSS variable colors.',
    };

    const qStyle: Record<string, string> = {
        'Blank space below': 'Question slides have ZERO solution content. Only the question text with a teal left border (4px), large font (1.9rem), and completely empty black space below for live solving.',
        'With solution toggle': 'Question slides show the question text prominently, with a "Show Solution" button below. When clicked, the solution appears with a fade-in animation.',
        'With hint': 'Question slides show the question text, followed by a "Show Hint" button. Clicking reveals progressive hints one at a time.',
    };

    const practiceSection = form.practiceQuestions.trim()
        ? `
## PRACTICE QUESTIONS

Each question gets its own slide. ${qStyle[form.questionSlideStyle] || qStyle['Blank space below']}

Questions:
${form.practiceQuestions}
`
        : '';

    return `# Master Prompt: ${form.topicName} — Interactive Visual Presentation

---

## IDENTITY & MISSION

You are building a **premium interactive HTML presentation** to teach **${form.topicName}** to ${form.targetAudience} students. The presentation is for ${form.presentationPurpose}. Every animation must be purposeful and pedagogically sequenced — building intuition step by step, never revealing a formula before the student has *seen* why it must be true. Colors must be high-contrast against the dark background. Target approximately ${form.slideCount} slides total (concept slides + question slides).

---

## CRITICAL CONSTRAINTS

1. **OUTPUT MUST BE A SINGLE .html FILE under 3000 lines.** If the content requires more, focus on the most important concepts and trim practice questions.
2. **DO NOT use requestFullscreen() or any fullscreen API calls.** The presentation will be embedded in an iframe. Remove ALL fullscreen logic.
3. **DO NOT let any text, animation, or content overflow or get cut off** on the sides or bottom of the slide area. Use proper overflow handling (\`overflow-y: auto\` if needed), text wrapping, and safe padding.
4. **NAVIGATION OVERLAP:** The bottom of the slide (where Next/Previous buttons are) MUST NOT overlap with the content. Ensure your slide content container has at least \`padding-bottom: 120px;\` so the bottom controls are strictly separate from the educational content.
5. **TEXT FORMATTING (STRICT):** DO NOT break lines artificially or use fancy flex/grid for inline text that makes sentences hard to read. Text must flow naturally in standard \`<p>\` or \`<li>\` tags. A line of text should NEVER be broken into two rows arbitrarily.
6. **PREMIUM MATH QUALITY:** As this is for Math teachers, use high-quality typography. Wrap math in KaTeX \`\\[ \\]\` for display and \`\\( \\)\` for inline. Use \`\\begin{bmatrix}\` for matrices, aligning columns beautifully. Use elegant theorem boxes for definitions/formulas.
7. **DYNAMIC KATEX RENDERING:** If you use JavaScript to reveal hints, solutions, or dynamically inject text, you MUST call \`if (window.renderMathInElement) window.renderMathInElement(document.body);\` immediately after the DOM update. Never leave raw LaTeX on the screen.
8. **CDNs only. No frameworks. Single file output.**
9. Output ONLY the raw HTML code. No markdown code fences. No explanation text before or after. Just the HTML.

---

## COLOR PALETTE

\`\`\`css
${colorPalette}
\`\`\`

---

## TECHNICAL ARCHITECTURE

### Container & Scaling
\`\`\`javascript
function resize() {
    const app = document.getElementById('app');
    const s = Math.min(window.innerWidth/1600, window.innerHeight/850) * 0.98;
    app.style.transform = \\\`scale(\\\${s})\\\`;
    app.style.left = \\\`\\\${(window.innerWidth - 1600*s)/2}px\\\`;
    app.style.top  = \\\`\\\${(window.innerHeight - 850*s)/2}px\\\`;
    app.style.position = 'absolute';
}
window.addEventListener('resize', resize);
window.addEventListener('load', resize);
\`\`\`

\`\`\`css
body { background: var(--bg); margin:0; overflow:hidden;
       font-family:'${font}',sans-serif; color:var(--text); }
#app  { width:1600px; height:850px; position:absolute;
        background:var(--bg); overflow:hidden; transform-origin:top left; }
\`\`\`

### CDNs
\`\`\`html
<link href="https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"><\/script>
\`\`\`

### Slide Navigation
Implement keyboard arrow keys (Left/Right) and on-screen Prev/Next buttons. Show slide counter and progress bar at the bottom.

---

## OBJECT VISUAL DESIGN

${objectDesc[form.objectRepresentation] || objectDesc['Colored tiles']}

---

## ANIMATION REQUIREMENTS

${animDesc[form.animationLevel] || animDesc['Moderate']}

---

## INTERACTIVITY

${interactiveDesc}

---

## CONTENT: KEY CONCEPTS TO DEMONSTRATE

${form.keyConcepts}

---

## SPECIFIC DETAILS TO INCLUDE

${form.specificDetails || 'Use your best pedagogical judgment for examples and edge cases.'}

---

## SEQUENCE & SCREENPLAY

${form.sequenceScreenplay || 'Follow a natural pedagogical progression: start with intuition-building examples, then reveal patterns, then formalize with formulas, then practice.'}

${practiceSection}

## ADDITIONAL INSTRUCTIONS

${form.additionalInstructions || 'None.'}

---

## OUTPUT SPECIFICATION

Single \`.html\` file. CDNs only. No frameworks. No fullscreen API calls.

**Final checklist:**
- [ ] All content stays within the 1600x850 slide area with safe padding (40px on sides, 120px on bottom)
- [ ] No text or animation gets cut off on any edge (bottom matrix is fully visible)
- [ ] Next/Previous buttons NEVER overlap with the main content
- [ ] Text flows naturally and is NOT broken artificially into multiple columns/rows
- [ ] No requestFullscreen() calls anywhere
- [ ] Keyboard ← → navigation works
- [ ] On-screen Prev/Next buttons work
- [ ] Progress bar and slide counter present
- [ ] KaTeX renders math on every slide transition with premium formatting (matrices, aligned equations)
- [ ] DYNAMIC KATEX: \`renderMathInElement(document.body)\` is explicitly called inside any JS functions that reveal hints/solutions
- [ ] resize() called on load and resize
- [ ] All buttons are touch-friendly (min 60px height)
- [ ] Animations are smooth and purposeful
- [ ] Under 3000 lines total
- [ ] Output is ONLY the HTML code, nothing else`;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const formData: any = body.formData;

        if (!formData || !formData.topicName) {
            return new Response(JSON.stringify({ error: 'Topic name is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const masterPrompt = buildMasterPrompt(formData);

        // Estimate tokens for tracking
        const estimatedTokens = Math.ceil(masterPrompt.length / 4) + 2000;

        const modelName = formData.modelChoice === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 65536,
                temperature: 0.7,
            },
        });

        const result = await model.generateContentStream(masterPrompt);

        // Usage tracking removed to prevent Edge runtime hanging

        // Create a streaming response
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
        console.error('Magic PPT Generate Error:', error);
        
        let errorDetails = 'Generation failed';
        if (error?.message) {
            errorDetails = error.message;
        } else if (typeof error === 'object') {
            try { errorDetails = JSON.stringify(error); } catch(e){}
        } else {
            errorDetails = String(error);
        }

        return new Response(JSON.stringify({ error: `Debug Error: ${errorDetails}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
