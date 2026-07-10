'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Sparkles, Download, Maximize2, Minimize2, ChevronDown, ChevronRight,
    Play, RefreshCw, Wand2, FileCode, Eye, Palette, Type, Layout,
    Zap, HelpCircle, PenTool, RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

/* ──────────────────────────── TYPES ──────────────────────────── */

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

const DEFAULT_FORM: FormData = {
    topicName: '',
    targetAudience: 'Class 11/12',
    presentationPurpose: 'Classroom Teaching on Interactive Flat Panel',
    bgColorScheme: 'Pure Black',
    customBgColor: '#000000',
    colorTone: 'Broadcast-Safe Muted',
    accentColor: '#5ba3a0',
    fontStyle: 'Poppins',
    keyConcepts: '',
    specificDetails: '',
    sequenceScreenplay: '',
    slideCount: 30,
    animationLevel: 'Maximum',
    interactiveElements: ['Clickable reveals', 'Input fields'],
    objectRepresentation: 'Colored tiles',
    practiceQuestions: '',
    questionSlideStyle: 'Blank space below',
    additionalInstructions: '',
};

const INTERACTIVE_OPTIONS = [
    'Clickable reveals', 'Quizzes', 'Input fields',
    'Drag-and-drop', 'Calculator widgets', 'Hover interactions',
];

const PLAYFUL_MESSAGES = [
    "Brewing magical slides...",
    "Sprinkling animations...",
    "Polishing transitions...",
    "Adding sparkle effects...",
    "Weaving the storyline...",
    "Painting the color palette...",
    "Crafting interactive widgets...",
    "Assembling the grand reveal...",
    "Fine-tuning the choreography...",
    "Almost there, perfecting the finale...",
    "Making math beautiful...",
    "Building slide-by-slide magic...",
    "Rendering gorgeous gradients...",
    "Connecting the concepts...",
    "Adding the wow factor...",
];

/* ──────────────────────── HELPER: sanitize HTML for iframe ──────────────────────── */
function sanitizeForIframe(html: string): string {
    // Strip ALL fullscreen API calls that could crash the iframe
    let safe = html;
    safe = safe.replace(/document\.documentElement\.requestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/document\.body\.requestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/el\.requestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/el\.webkitRequestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/\.requestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/\.webkitRequestFullscreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/\.mozRequestFullScreen\(\)/g, '/* fullscreen disabled */');
    safe = safe.replace(/\.msRequestFullscreen\(\)/g, '/* fullscreen disabled */');
    // Also remove splash screens that wait for fullscreen
    safe = safe.replace(/if\s*\(el\.requestFullscreen\)/g, 'if (false)');
    safe = safe.replace(/if\s*\(el\.webkitRequestFullscreen\)/g, 'if (false)');
    // Strip any markdown code fences that Gemini might include
    safe = safe.replace(/^```html\s*/i, '');
    safe = safe.replace(/^```\s*/i, '');
    safe = safe.replace(/\s*```\s*$/, '');
    return safe;
}

/* ──────────────────────── COLLAPSIBLE SECTION ──────────────────────── */
function Section({ title, icon: Icon, children, defaultOpen = true }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden mb-3">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors text-left"
            >
                <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-200 flex-1">{title}</span>
                {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {open && (
                <div className="px-4 py-3 space-y-3 bg-slate-900/50">
                    {children}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────── FIELD HELPERS ──────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-medium text-slate-400 mb-1">{children}</label>;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        />
    );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
        >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-slate-800/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none custom-scrollbar"
        />
    );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function MagicPPTPage() {
    const [form, setForm] = useState<FormData>(DEFAULT_FORM);
    const [generatedHtml, setGeneratedHtml] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isFullPreview, setIsFullPreview] = useState(false);
    const [modificationNotes, setModificationNotes] = useState('');
    const [targetSlide, setTargetSlide] = useState('All');
    const [playfulMsg, setPlayfulMsg] = useState(PLAYFUL_MESSAGES[0]);
    const [streamedText, setStreamedText] = useState('');

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const msgRef = useRef<NodeJS.Timeout | null>(null);

    const update = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
        setForm(prev => ({ ...prev, [key]: val }));
    }, []);

    /* ── Auth headers ── */
    const getHeaders = () => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            const t = localStorage.getItem('auth_token') || '';
            if (t) headers['Authorization'] = `Bearer ${t}`;
            if (u.email) headers['X-User-Email'] = u.email;
        } catch {}
        return headers;
    };

    /* ── Timer logic ── */
    const startTimer = () => {
        setElapsedTime(0);
        setPlayfulMsg(PLAYFUL_MESSAGES[0]);
        let msgIdx = 0;
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        msgRef.current = setInterval(() => {
            msgIdx = (msgIdx + 1) % PLAYFUL_MESSAGES.length;
            setPlayfulMsg(PLAYFUL_MESSAGES[msgIdx]);
        }, 3500);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (msgRef.current) clearInterval(msgRef.current);
        timerRef.current = null;
        msgRef.current = null;
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'HTML_UPDATE' && event.data.html) {
                // Update without triggering re-render of iframe to prevent cursor loss
                // We use a ref for the latest HTML if we just want to save it, 
                // but setting state is fine as long as we don't pass it back to srcDoc if it's the exact same.
                // To avoid iframe reload loop, we just keep it in state for the Download button.
                setGeneratedHtml(event.data.html);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => {
            stopTimer();
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    /* ── Validate form ── */
    const validateForm = (): string | null => {
        if (!form.topicName.trim()) return 'Please enter a topic name.';
        if (!form.keyConcepts.trim()) return 'Please describe the key concepts to demonstrate.';
        // Check for potentially oversized content
        const totalChars = form.keyConcepts.length + form.specificDetails.length +
            form.sequenceScreenplay.length + form.practiceQuestions.length + form.additionalInstructions.length;
        if (totalChars > 16000) {
            return 'Your content is very long and may exceed the 3000-line HTML limit. Please break your content into smaller parts or reduce the detail level.';
        }
        return null;
    };

    /* ── Generate PPT ── */
    const handleGenerate = async () => {
        const err = validateForm();
        if (err) { toast.error(err); return; }

        setIsGenerating(true);
        setStreamedText('');
        setGeneratedHtml('');
        startTimer();

        try {
            const res = await fetch('/api/admin/magic-ppt/generate', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ formData: form }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Generation failed' }));
                throw new Error(errData.error || 'Generation failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                setStreamedText(fullText);
            }

            const wysiwygScript = `
<script>
    // WYSIWYG Editing Logic
    const makeEditable = () => {
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li').forEach(el => {
            if (!el.hasAttribute('contenteditable')) {
                el.setAttribute('contenteditable', 'true');
                el.style.outline = 'none';
                el.style.cursor = 'text';
            }
        });
        
        // Handle KaTeX specifically
        document.querySelectorAll('.katex-display, .katex').forEach(el => {
            if (!el.hasAttribute('contenteditable')) {
                el.setAttribute('contenteditable', 'true');
                el.style.outline = '1px dashed #5ba3a0';
                el.style.cursor = 'text';
                el.title = "Click to edit LaTeX";
                
                el.addEventListener('focus', function() {
                    const annotation = el.querySelector('annotation');
                    if (annotation) {
                        el.dataset.originalHtml = el.innerHTML;
                        el.textContent = annotation.textContent; // Show raw latex
                    }
                });
                el.addEventListener('blur', function() {
                    if (el.dataset.originalHtml !== undefined) {
                        if (window.renderMathInElement) window.renderMathInElement(el.parentElement);
                        delete el.dataset.originalHtml;
                    }
                });
            }
        });
    };

    window.addEventListener('load', makeEditable);
    
    // Listen for manual edits and send to parent
    document.addEventListener('input', () => {
        window.parent.postMessage({ type: 'HTML_UPDATE', html: document.documentElement.outerHTML }, '*');
    });
</script>
`;
            const cleanHtml = sanitizeForIframe(fullText) + wysiwygScript;
            setGeneratedHtml(cleanHtml);
            toast.success('Presentation generated successfully!');
        } catch (e: any) {
            toast.error(e.message || 'Failed to generate presentation');
        } finally {
            setIsGenerating(false);
            stopTimer();
        }
    };

    /* ── Refine PPT ── */
    const handleRefine = async () => {
        if (!modificationNotes.trim()) {
            toast.error('Please describe what changes you want.');
            return;
        }
        if (!generatedHtml) {
            toast.error('Generate a presentation first.');
            return;
        }

        setIsRefining(true);
        setStreamedText('');
        startTimer();

        try {
            const res = await fetch('/api/admin/magic-ppt/refine', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    existingHtml: generatedHtml,
                    instructions: modificationNotes,
                    targetSlide: targetSlide,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Refinement failed' }));
                throw new Error(errData.error || 'Refinement failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                setStreamedText(fullText);
            }

            const wysiwygScript = `
<script>
    const makeEditable = () => {
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li').forEach(el => {
            if (!el.hasAttribute('contenteditable')) { el.setAttribute('contenteditable', 'true'); el.style.outline = 'none'; }
        });
        document.querySelectorAll('.katex-display, .katex').forEach(el => {
            if (!el.hasAttribute('contenteditable')) {
                el.setAttribute('contenteditable', 'true'); el.style.outline = '1px dashed #5ba3a0';
                el.addEventListener('focus', function() {
                    const annotation = el.querySelector('annotation');
                    if (annotation) { el.dataset.originalHtml = el.innerHTML; el.textContent = annotation.textContent; }
                });
                el.addEventListener('blur', function() {
                    if (el.dataset.originalHtml !== undefined) {
                        if (window.renderMathInElement) window.renderMathInElement(el.parentElement);
                        delete el.dataset.originalHtml;
                    }
                });
            }
        });
    };
    window.addEventListener('load', makeEditable);
    document.addEventListener('input', () => {
        window.parent.postMessage({ type: 'HTML_UPDATE', html: document.documentElement.outerHTML }, '*');
    });
</script>
`;
            const cleanHtml = sanitizeForIframe(fullText) + wysiwygScript;
            setGeneratedHtml(cleanHtml);
            setModificationNotes('');
            toast.success('Presentation refined successfully!');
        } catch (e: any) {
            toast.error(e.message || 'Failed to refine presentation');
        } finally {
            setIsRefining(false);
            stopTimer();
        }
    };

    /* ── Download ── */
    const handleDownload = () => {
        if (!generatedHtml) return;
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'index.html';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded as index.html!');
    };

    const isWorking = isGenerating || isRefining;

    /* ════════════════════════════ RENDER ════════════════════════════ */

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden relative">

            {/* ── LOADING OVERLAY ── */}
            {isWorking && (
                <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center">
                    {/* Animated magic wand */}
                    <div className="relative mb-8">
                        <div className="w-28 h-28 rounded-full border-2 border-indigo-500/30 flex items-center justify-center animate-pulse">
                            <Wand2 className="w-14 h-14 text-indigo-400 animate-bounce" style={{ animationDuration: '2s' }} />
                        </div>
                        {/* Sparkle particles */}
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-2 h-2 rounded-full"
                                style={{
                                    background: ['#818cf8', '#c084fc', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb923c'][i],
                                    top: `${50 + 55 * Math.sin((i / 8) * Math.PI * 2)}%`,
                                    left: `${50 + 55 * Math.cos((i / 8) * Math.PI * 2)}%`,
                                    transform: 'translate(-50%, -50%)',
                                    animation: `sparkle-orbit 3s ease-in-out infinite ${i * 0.375}s`,
                                }}
                            />
                        ))}
                    </div>

                    {/* Timer */}
                    <div className="text-6xl font-bold text-indigo-400 tabular-nums mb-4 tracking-wider" style={{ fontFamily: 'monospace' }}>
                        {formatTime(elapsedTime)}
                    </div>

                    {/* Playful message */}
                    <div className="text-lg text-slate-400 animate-pulse mb-6 h-7 transition-all duration-500">
                        {playfulMsg}
                    </div>

                    {/* Progress bar (pulsing) */}
                    <div className="w-80 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                            style={{
                                animation: 'loading-shimmer 2s ease-in-out infinite',
                                width: '100%',
                            }}
                        />
                    </div>

                    <p className="text-xs text-slate-600 mt-6">
                        {isRefining ? 'Applying modifications...' : 'Generating your presentation...'}
                        {' '}This usually takes 30–90 seconds.
                    </p>
                </div>
            )}

            {/* ── HEADER ── */}
            <div className="shrink-0 h-14 border-b border-white/10 flex items-center px-6 gap-4 bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-white">
                        The Magic <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">PPT</span>
                    </h1>
                </div>
                <span className="text-xs text-slate-500 hidden md:inline">AI-Powered Interactive Presentation Generator</span>
                <div className="flex-1" />

                {generatedHtml && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-green-500/20"
                        >
                            <Download className="w-4 h-4" /> Download index.html
                        </button>
                        <button
                            onClick={() => setIsFullPreview(!isFullPreview)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                            title={isFullPreview ? 'Exit fullscreen preview' : 'Fullscreen preview'}
                        >
                            {isFullPreview ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>

            {/* ── SPLIT SCREEN ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT PANEL: Questionnaire ── */}
                {!isFullPreview && (
                    <div className="w-[35%] min-w-[360px] max-w-[480px] border-r border-white/10 flex flex-col bg-slate-950">
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">

                            {/* Section 1: Topic */}
                            <Section title="Topic & Identity" icon={Type} defaultOpen={true}>
                                <div>
                                    <Label>Topic Name *</Label>
                                    <Input value={form.topicName} onChange={v => update('topicName', v)} placeholder="e.g. Permutation & Combination" />
                                </div>
                                <div>
                                    <Label>Target Audience</Label>
                                    <Select value={form.targetAudience} onChange={v => update('targetAudience', v)} options={['Class 11/12', 'Undergraduate', 'Graduate', 'General Audience']} />
                                </div>
                                <div>
                                    <Label>Presentation Purpose</Label>
                                    <Select value={form.presentationPurpose} onChange={v => update('presentationPurpose', v)} options={['Classroom Teaching on Interactive Flat Panel', 'Online Broadcast via Webcam', 'Self-Study / Reference', 'Conference / Seminar']} />
                                </div>
                            </Section>

                            {/* Section 2: Visual Design */}
                            <Section title="Visual Design" icon={Palette} defaultOpen={false}>
                                <div>
                                    <Label>Background</Label>
                                    <Select value={form.bgColorScheme} onChange={v => update('bgColorScheme', v)} options={['Pure Black', 'Dark Gray', 'Deep Navy', 'Custom']} />
                                </div>
                                {form.bgColorScheme === 'Custom' && (
                                    <div>
                                        <Label>Custom Background Color</Label>
                                        <div className="flex gap-2 items-center">
                                            <input type="color" value={form.customBgColor} onChange={e => update('customBgColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                                            <Input value={form.customBgColor} onChange={v => update('customBgColor', v)} placeholder="#000000" />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <Label>Color Tone</Label>
                                    <Select value={form.colorTone} onChange={v => update('colorTone', v)} options={['Broadcast-Safe Muted', 'Vibrant', 'Pastel', 'Monochrome']} />
                                </div>
                                <div>
                                    <Label>Accent Color</Label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={form.accentColor} onChange={e => update('accentColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                                        <Input value={form.accentColor} onChange={v => update('accentColor', v)} placeholder="#5ba3a0" />
                                    </div>
                                </div>
                                <div>
                                    <Label>Font</Label>
                                    <Select value={form.fontStyle} onChange={v => update('fontStyle', v)} options={['Poppins', 'Inter', 'Roboto', 'Outfit']} />
                                </div>
                            </Section>

                            {/* Section 3: Content */}
                            <Section title="Content Structure" icon={Layout} defaultOpen={true}>
                                <div>
                                    <Label>Key Concepts to Demonstrate *</Label>
                                    <Textarea value={form.keyConcepts} onChange={v => update('keyConcepts', v)} placeholder="List the core ideas, theorems, formulas you want demonstrated visually..." rows={5} />
                                </div>
                                <div>
                                    <Label>Specific Details to Include</Label>
                                    <Textarea value={form.specificDetails} onChange={v => update('specificDetails', v)} placeholder="Particular proofs, examples, edge cases, special notations..." rows={3} />
                                </div>
                                <div>
                                    <Label>Sequence & Screenplay</Label>
                                    <Textarea value={form.sequenceScreenplay} onChange={v => update('sequenceScreenplay', v)} placeholder="e.g. Start with 3 objects, show all arrangements, then reveal the pattern, then generalize to n!..." rows={4} />
                                </div>
                                <div>
                                    <Label>Number of Slides: {form.slideCount}</Label>
                                    <input
                                        type="range" min={8} max={50} value={form.slideCount}
                                        onChange={e => update('slideCount', parseInt(e.target.value))}
                                        className="w-full accent-indigo-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-600">
                                        <span>8</span>
                                        <span className="text-amber-500 text-[10px]">{form.slideCount > 35 ? '⚠ May need to split into parts' : ''}</span>
                                        <span>50</span>
                                    </div>
                                </div>
                            </Section>

                            {/* Section 4: Animations */}
                            <Section title="Animations & Interactivity" icon={Zap} defaultOpen={false}>
                                <div>
                                    <Label>Animation Level</Label>
                                    <Select value={form.animationLevel} onChange={v => update('animationLevel', v)} options={['Minimal', 'Moderate', 'Maximum']} />
                                </div>
                                <div>
                                    <Label>Interactive Elements</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {INTERACTIVE_OPTIONS.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const has = form.interactiveElements.includes(opt);
                                                    update('interactiveElements', has
                                                        ? form.interactiveElements.filter(x => x !== opt)
                                                        : [...form.interactiveElements, opt]
                                                    );
                                                }}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${form.interactiveElements.includes(opt)
                                                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                                        : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-white/20'
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Label>Object Representation</Label>
                                    <Select value={form.objectRepresentation} onChange={v => update('objectRepresentation', v)} options={['Colored tiles', 'Circles', 'Cards']} />
                                </div>
                            </Section>

                            {/* Section 5: Questions */}
                            <Section title="Practice Questions" icon={HelpCircle} defaultOpen={false}>
                                <div>
                                    <Label>Questions (one per line)</Label>
                                    <Textarea value={form.practiceQuestions} onChange={v => update('practiceQuestions', v)} placeholder="In how many ways can the letters of BENGAL be arranged?&#10;Find 10C3..." rows={4} />
                                </div>
                                <div>
                                    <Label>Question Slide Style</Label>
                                    <Select value={form.questionSlideStyle} onChange={v => update('questionSlideStyle', v)} options={['Blank space below', 'With solution toggle', 'With hint']} />
                                </div>
                            </Section>

                            {/* Section 6: Additional */}
                            <Section title="Additional Instructions" icon={PenTool} defaultOpen={false}>
                                <div>
                                    <Textarea value={form.additionalInstructions} onChange={v => update('additionalInstructions', v)} placeholder="Any extra requirements, special formatting, specific animations..." rows={4} />
                                </div>
                            </Section>

                        </div>

                        {/* ── BOTTOM ACTION BAR ── */}
                        <div className="shrink-0 p-4 border-t border-white/10 bg-slate-900/50 space-y-3">
                            {/* Modification notes (shown only after generation) */}
                            {generatedHtml && (
                                <div className="space-y-2">
                                    <Label>Modification Notes</Label>
                                    <Textarea
                                        value={modificationNotes}
                                        onChange={v => setModificationNotes(v)}
                                        placeholder="e.g. Make slide 5 animations faster, change object C color to blue..."
                                        rows={2}
                                    />
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Label>Target Slide (e.g. 3, or 'All')</Label>
                                            <Input value={targetSlide} onChange={v => setTargetSlide(v)} placeholder="All" />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleRefine}
                                        disabled={isWorking}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Refine Existing
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={isWorking}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles className="w-4 h-4" />
                                {generatedHtml ? 'Regenerate from Scratch' : 'Generate Presentation'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── RIGHT PANEL: Preview ── */}
                <div className={`flex-1 flex flex-col bg-black ${isFullPreview ? 'w-full' : ''}`}>
                    {generatedHtml ? (
                        <>
                            {/* Preview toolbar */}
                            <div className="shrink-0 h-10 border-b border-white/10 flex items-center px-4 gap-3 bg-slate-900/60">
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs font-medium text-slate-400">Live Preview — Interactive</span>
                                <div className="flex-1" />
                                <span className="text-[10px] text-slate-600">
                                    {generatedHtml.split('\n').length} lines
                                </span>
                                {isFullPreview && (
                                    <button
                                        onClick={() => setIsFullPreview(false)}
                                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                                    >
                                        <Minimize2 className="w-3 h-3" /> Exit Fullscreen
                                    </button>
                                )}
                            </div>

                            {/* iframe */}
                            <div className="flex-1 relative">
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={generatedHtml}
                                    className="absolute inset-0 w-full h-full border-0"
                                    sandbox="allow-scripts allow-same-origin"
                                    title="Presentation Preview"
                                />
                            </div>
                        </>
                    ) : (
                        /* Empty state */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md px-8">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                                    <Wand2 className="w-12 h-12 text-indigo-400/60" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-300 mb-2">Your presentation will appear here</h2>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Fill in the questionnaire on the left, then click <strong className="text-indigo-400">Generate Presentation</strong> to create
                                    a stunning interactive HTML presentation powered by AI.
                                </p>
                                <div className="mt-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-400/80">
                                        <strong>Tip:</strong> Keep content focused for best results. If your topic is large,
                                        break it into parts to stay under the 3000-line limit.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── GLOBAL STYLES ── */}
            <style jsx global>{`
                @keyframes sparkle-orbit {
                    0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.5); }
                    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
                }
                @keyframes loading-shimmer {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
