'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Sparkles, Download, Maximize2, Minimize2, ChevronDown, ChevronRight,
    Play, RefreshCw, Wand2, FileCode, Eye, Palette, Type, Layout,
    Zap, HelpCircle, PenTool, RotateCcw, ArrowLeft, ClipboardPaste
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PPTFormData, buildMasterPrompt } from './utils';

/* ──────────────────────────── CONSTANTS ──────────────────────────── */

const INTERACTIVE_OPTIONS = [
    'Clickable reveals',
    'Drag & drop zones',
    'Hover effects',
    'Input fields',
    'Multiple choice',
    'Step-by-step sliders'
];

const DEFAULT_FORM: PPTFormData = {
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
    modelChoice: 'gemini-2.5-flash',
};

/* ──────────────────────────── COMPONENTS ──────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5 mt-3">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all ${props.className || ''}`}
        />
    );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={`w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all custom-scrollbar ${props.className || ''}`}
        />
    );
}

function Select({ value, onChange, options }: { value: string, onChange: (v: string) => void, options: string[] }) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-200 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
            >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
        </div>
    );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/5 rounded-xl bg-slate-900/30 overflow-hidden mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-slate-800 text-indigo-400">
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{title}</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-4 pt-0 border-t border-white/5 bg-slate-900/10">
                    {children}
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────── MAIN PAGE ──────────────────────────── */

export default function MagicPPTPage() {
    const [form, setForm] = useState<PPTFormData>(DEFAULT_FORM);
    const [workflowStep, setWorkflowStep] = useState<'form' | 'paste'>('form');
    const [pastedCode, setPastedCode] = useState('');
    const [generatedHtml, setGeneratedHtml] = useState('');
    const [isFullPreview, setIsFullPreview] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const update = (key: keyof PPTFormData, value: any) => setForm(f => ({ ...f, [key]: value }));

    // Load draft on mount
    useEffect(() => {
        const draft = localStorage.getItem('magic_ppt_form_draft');
        if (draft) {
            try { setForm(JSON.parse(draft)); } catch (e) { }
        }
    }, []);

    // Save draft
    useEffect(() => {
        localStorage.setItem('magic_ppt_form_draft', JSON.stringify(form));
    }, [form]);

    // Sanitize HTML
    const sanitizeForIframe = (html: string) => {
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove existing scripts
            .replace(/on\w+="[^"]*"/gi, '') // Remove inline handlers
            .replace(/javascript:/gi, '');
    };

    // WYSIWYG Injection
    const getWysiwygScript = () => `
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

    // Process pasted code automatically
    useEffect(() => {
        if (!pastedCode.trim()) {
            setGeneratedHtml('');
            return;
        }

        // Clean any code fences if they accidentally pasted them
        let cleanCode = pastedCode.trim();
        if (cleanCode.startsWith('\`\`\`html')) cleanCode = cleanCode.substring(7);
        if (cleanCode.startsWith('\`\`\`')) cleanCode = cleanCode.substring(3);
        if (cleanCode.endsWith('\`\`\`')) cleanCode = cleanCode.substring(0, cleanCode.length - 3);

        const cleanHtml = sanitizeForIframe(cleanCode) + getWysiwygScript();
        setGeneratedHtml(cleanHtml);
    }, [pastedCode]);

    const validateForm = (): string | null => {
        if (!form.topicName.trim()) return 'Please enter a topic name.';
        if (!form.keyConcepts.trim()) return 'Please describe the key concepts to demonstrate.';
        return null;
    };

    const handleDownloadPrompt = () => {
        const err = validateForm();
        if (err) { toast.error(err); return; }

        const promptText = buildMasterPrompt(form);

        // Download Prompt
        const blob = new Blob([promptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `magic_ppt_prompt_${form.topicName.replace(/\s+/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Prompt downloaded! Paste it into Gemini Advanced.');
        setWorkflowStep('paste');
    };

    const handleDownloadHtml = () => {
        if (!generatedHtml) return;
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'presentation.html';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded as presentation.html!');
    };

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden relative">

            {/* ── HEADER ── */}
            <div className="shrink-0 h-14 border-b border-white/10 flex items-center px-6 gap-4 bg-slate-900/80 backdrop-blur-sm z-10">
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
                            onClick={handleDownloadHtml}
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

                {/* ── LEFT PANEL ── */}
                {!isFullPreview && (
                    <div className="w-[35%] min-w-[360px] max-w-[480px] border-r border-white/10 flex flex-col bg-slate-950">
                        
                        {workflowStep === 'form' ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
                                    <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-sm text-indigo-200">
                                        <p><strong>New Workflow:</strong> Instead of hitting limits, we now generate an elite, highly detailed prompt file. Download it, paste it into your Google AI Studio account, and paste the code back here.</p>
                                    </div>

                                    {/* Section 1: Topic */}
                                    <Section title="Topic & Identity" icon={Type} defaultOpen={true}>
                                        <div>
                                            <Label>Topic Name *</Label>
                                            <Input value={form.topicName} onChange={v => update('topicName', v.target.value)} placeholder="e.g. Permutation & Combination" />
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
                                                    <Input value={form.customBgColor} onChange={v => update('customBgColor', v.target.value)} placeholder="#000000" />
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
                                                <Input value={form.accentColor} onChange={v => update('accentColor', v.target.value)} placeholder="#5ba3a0" />
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
                                            <Textarea value={form.keyConcepts} onChange={v => update('keyConcepts', v.target.value)} placeholder="List the core ideas, theorems, formulas you want demonstrated visually..." rows={5} />
                                        </div>
                                        <div>
                                            <Label>Specific Details to Include</Label>
                                            <Textarea value={form.specificDetails} onChange={v => update('specificDetails', v.target.value)} placeholder="Particular proofs, examples, edge cases, special notations..." rows={3} />
                                        </div>
                                        <div>
                                            <Label>Sequence & Screenplay</Label>
                                            <Textarea value={form.sequenceScreenplay} onChange={v => update('sequenceScreenplay', v.target.value)} placeholder="e.g. Start with 3 objects, show all arrangements, then reveal the pattern, then generalize to n!..." rows={4} />
                                        </div>
                                        <div>
                                            <Label>Number of Slides: {form.slideCount}</Label>
                                            <input
                                                type="range" min={8} max={50} value={form.slideCount}
                                                onChange={e => update('slideCount', parseInt(e.target.value))}
                                                className="w-full accent-indigo-500"
                                            />
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
                                            <Textarea value={form.practiceQuestions} onChange={v => update('practiceQuestions', v.target.value)} placeholder="In how many ways can the letters of BENGAL be arranged?&#10;Find 10C3..." rows={4} />
                                        </div>
                                        <div>
                                            <Label>Question Slide Style</Label>
                                            <Select value={form.questionSlideStyle} onChange={v => update('questionSlideStyle', v)} options={['Blank space below', 'With solution toggle', 'With hint']} />
                                        </div>
                                    </Section>

                                    {/* Section 6: Additional */}
                                    <Section title="Additional Instructions" icon={PenTool} defaultOpen={false}>
                                        <div>
                                            <Textarea value={form.additionalInstructions} onChange={v => update('additionalInstructions', v.target.value)} placeholder="Any extra requirements, special formatting, specific animations..." rows={4} />
                                        </div>
                                    </Section>
                                </div>

                                <div className="shrink-0 p-4 border-t border-white/10 bg-slate-900/50">
                                    <button
                                        onClick={handleDownloadPrompt}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Master Prompt
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col p-4 bg-slate-900/20">
                                <button 
                                    onClick={() => setWorkflowStep('form')}
                                    className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors self-start"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back to Form
                                </button>
                                
                                <div className="mb-2 flex items-center gap-2 text-indigo-300 font-semibold">
                                    <ClipboardPaste className="w-5 h-5" />
                                    <h2>Paste Generated HTML Here</h2>
                                </div>
                                <p className="text-xs text-slate-500 mb-4">
                                    Take the `.txt` file that just downloaded, paste it into Google AI Studio, and copy their HTML response here.
                                </p>

                                <textarea 
                                    value={pastedCode}
                                    onChange={(e) => setPastedCode(e.target.value)}
                                    placeholder="<!DOCTYPE html>&#10;<html>&#10;..."
                                    className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-emerald-400 font-mono resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar whitespace-pre"
                                />
                            </div>
                        )}
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
                                <button
                                    onClick={() => {
                                        localStorage.setItem('magic_ppt_draft', generatedHtml);
                                        window.open('/admin/magic-ppt/editor', '_blank');
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors ml-2"
                                >
                                    <FileCode className="w-3.5 h-3.5" />
                                    Open Visual Editor
                                </button>
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
                                <h2 className="text-xl font-bold text-slate-300 mb-2">Ready for brilliance</h2>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    {workflowStep === 'form' 
                                        ? "Fill in the details and click Download Master Prompt to start."
                                        : "Paste your generated HTML into the left panel to see the live preview."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
