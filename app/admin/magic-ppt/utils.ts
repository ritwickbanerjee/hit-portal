export interface PPTFormData {
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
    modelChoice: string;
}

export function buildColorPalette(form: PPTFormData): string {
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

export function buildMasterPrompt(form: PPTFormData): string {
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
        'Maximum': 'Use extremely rich, elaborate animations everywhere: staggered reveals, glassmorphism UI elements, cinematic 3D perspective transforms, dynamic ripple effects, GSAP-like fluid motions (using native CSS or GSAP via CDN). Make it visually stunning and state-of-the-art.',
    };

    const interactiveDesc = form.interactiveElements.length > 0
        ? `Include these interactive elements: ${form.interactiveElements.join(', ')}. Make all buttons beautifully styled with hover states and glow effects.`
        : 'Include clickable "Reveal" buttons for key formula/concept revelations. Style them gorgeously with glassmorphic or glowing hover states.';

    const objectDesc: Record<string, string> = {
        'Colored tiles': 'Every "object" is a beautiful modern tile (e.g. glassmorphism style or soft gradients) with a bold letter, rounded corners, subtle shadows. Use .obj-A, .obj-B classes with the CSS variable colors.',
        'Circles': 'Every "object" is a sleek colored circle with a bold letter centered inside. Add subtle inner shadows or gradients for depth.',
        'Cards': 'Every "object" is a premium card with soft frosted glass effects, rounded corners, padding, and a bold label.',
    };

    const qStyle: Record<string, string> = {
        'Blank space below': 'Question slides have ZERO solution content. Only the question text with a stunning colored left border (4px), large font, and completely empty space below for live solving.',
        'With solution toggle': 'Question slides show the question text prominently, with a gorgeous "Show Solution" button below. When clicked, the solution elegantly slides/fades in.',
        'With hint': 'Question slides show the question text, followed by a sleek "Show Hint" button. Clicking reveals progressive hints beautifully.',
    };

    const practiceSection = form.practiceQuestions.trim()
        ? `
## PRACTICE QUESTIONS

Each question gets its own slide. ${qStyle[form.questionSlideStyle] || qStyle['Blank space below']}

Questions:
${form.practiceQuestions}
`
        : '';

    return `# Master Prompt: ${form.topicName} — State-of-the-art Interactive HTML Presentation

---

## IDENTITY & MISSION

You are an elite web developer and pedagogic expert building a **visually spectacular, state-of-the-art interactive HTML presentation** to teach **${form.topicName}** to ${form.targetAudience} students. The presentation is for ${form.presentationPurpose}. 

You have **EXTREME CREATIVE FREEDOM**. Use modern web design trends: Glassmorphism, Neon/Glow effects, deep shadows, smooth cubic-bezier transitions, staggered reveals. Every animation must be purposeful and cinematic — building intuition step by step, never revealing a formula before the student has *seen* why it must be true. Colors must be high-contrast and vivid against the dark background. Target approximately ${form.slideCount} slides total.

---

## CRITICAL CONSTRAINTS

1. **OUTPUT MUST BE A SINGLE .html FILE.** You do not need to worry about line limits. Generate the full, extensive code.
2. **DO NOT use requestFullscreen() or any fullscreen API calls.** The presentation will be embedded in an iframe. Remove ALL fullscreen logic.
3. **DO NOT let any text, animation, or content overflow or get cut off** on the sides or bottom of the slide area. Use proper overflow handling (\`overflow-y: auto\` if needed), text wrapping, and safe padding.
4. **NAVIGATION OVERLAP:** The bottom of the slide (where Next/Previous buttons are) MUST NOT overlap with the content. Ensure your slide content container has at least \`padding-bottom: 120px;\` so the bottom controls are strictly separate from the educational content.
5. **TEXT FORMATTING (STRICT):** DO NOT break lines artificially or use fancy flex/grid for inline text that makes sentences hard to read. Text must flow naturally in standard \`<p>\` or \`<li>\` tags. A line of text should NEVER be broken into two rows arbitrarily. 
6. **PREMIUM MATH QUALITY:** As this is for Math teachers, use high-quality typography. Wrap math in KaTeX \`\\[ \\]\` for display and \`\\( \\)\` for inline. Use \`\\begin{bmatrix}\` for matrices, aligning columns beautifully. Use elegant theorem boxes with glow effects for definitions/formulas.
7. **DYNAMIC KATEX RENDERING:** If you use JavaScript to reveal hints, solutions, or dynamically inject text, you MUST call \`if (window.renderMathInElement) window.renderMathInElement(document.body);\` immediately after the DOM update. Never leave raw LaTeX on the screen.
8. **CDNs only.** You may use GSAP (via CDN) if you want cinematic animations, or just stick to highly advanced CSS animations.
9. Output ONLY the raw HTML code inside a single \`\`\`html code fence. No explanation text before or after. Just the code.

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
    app.style.transform = \`scale(\${s})\`;
    app.style.left = \`\${(window.innerWidth - 1600*s)/2}px\`;
    app.style.top  = \`\${(window.innerHeight - 850*s)/2}px\`;
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
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
\`\`\`

### Slide Navigation
Implement beautiful keyboard arrow keys (Left/Right) and sleek on-screen Prev/Next buttons. Show a modern, animated progress bar at the bottom.

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

${form.specificDetails || 'Use your best pedagogical judgment for examples and edge cases. Make them visually stunning.'}

---

## SEQUENCE & SCREENPLAY

${form.sequenceScreenplay || 'Follow a natural pedagogical progression: start with intuition-building examples, then reveal patterns, then formalize with formulas, then practice.'}

${practiceSection}

## ADDITIONAL INSTRUCTIONS

${form.additionalInstructions || 'Be extremely creative and professional.'}

---

## FINAL OUTPUT INSTRUCTIONS

Ensure the code is a full, valid HTML document. Do not output anything except the HTML code inside a \`\`\`html block.`;
}
