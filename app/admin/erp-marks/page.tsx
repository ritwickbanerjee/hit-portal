'use client';

import { useState } from 'react';
import {
    CheckCircle2, Copy, Download, ChevronRight, Sparkles,
    FileUp, MousePointerClick, KeyboardIcon, ClipboardCheck
} from 'lucide-react';

const GEMINI_PROMPT = `Task: Extract the roll numbers and marks from the attached document and output them strictly as a Markdown table with two columns: "Roll Number" and "Final Mark".

Rules for Roll Numbers (Column 1):
* A full university roll number is exactly 11 digits long.
* If you encounter a 2-digit or 3-digit number in the roll number column, it is an abbreviation. You must reconstruct the full 11-digit roll number by replacing the last digits of the most recently seen full 11-digit roll number with these new digits. (e.g., If "2625002043" is followed by "44", the second student's reconstructed roll is "2625002044").

Rules for Marks (Columns 2, 3, and 4):
* Read the marks from left to right.
* Ignore all checkmarks (☑, ✓) or blank spaces.
* Priority Rule: The marks available on the rightmost side are always the most updated and have the highest priority.
  * Head Examiner marks (Column 4) have the highest priority.
  * Scrutinizer marks (Column 3) have the second highest priority.
  * Examiner marks (Column 2) have the lowest priority.
* Output ONLY the single highest-priority mark for each student.

Output Format:
Provide ONLY the Markdown table. Do not include any introductory or concluding text.`;

const steps = [
    {
        number: 1,
        icon: Sparkles,
        title: 'Open Gemini & Extract Data',
        color: 'from-purple-600 to-indigo-600',
        borderColor: 'border-purple-500/30',
        bgColor: 'bg-purple-950/30',
        iconBg: 'bg-purple-500/20',
        iconColor: 'text-purple-400',
    },
    {
        number: 2,
        icon: FileUp,
        title: 'Paste Table into Excel',
        color: 'from-blue-600 to-cyan-600',
        borderColor: 'border-blue-500/30',
        bgColor: 'bg-blue-950/30',
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
    },
    {
        number: 3,
        icon: MousePointerClick,
        title: 'Install SmartPaste & Validate',
        color: 'from-amber-500 to-orange-600',
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-950/30',
        iconBg: 'bg-amber-500/20',
        iconColor: 'text-amber-400',
    },
    {
        number: 4,
        icon: KeyboardIcon,
        title: 'Auto-Fill Marks in ERP',
        color: 'from-green-600 to-emerald-600',
        borderColor: 'border-green-500/30',
        bgColor: 'bg-green-950/30',
        iconBg: 'bg-green-500/20',
        iconColor: 'text-green-400',
    },
];

export default function ErpMarksPage() {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(GEMINI_PROMPT);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-8 px-4 md:px-10">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                        <ClipboardCheck className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Uploading Marks in ERP</h1>
                        <p className="text-slate-400 text-sm mt-0.5">Auto-fill student marks from PDF/Image into the ERP portal in 4 steps</p>
                    </div>
                </div>
                <div className="h-px bg-gradient-to-r from-indigo-500/50 to-transparent mt-6" />
            </div>

            <div className="max-w-4xl mx-auto space-y-6">

                {/* STEP 1 */}
                <StepCard step={1} icon={Sparkles} title="Open Gemini & Extract Data" color="border-purple-500/30" bg="bg-purple-950/20" iconBg="bg-purple-500/20" iconColor="text-purple-400" badge="bg-purple-500">
                    <ol className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                            <span>Open <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="text-purple-400 underline underline-offset-2 hover:text-purple-300">gemini.google.com</a> and switch the model to <strong className="text-white">Gemini 2.5 Pro</strong> or higher.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                            <span>Upload your <strong className="text-white">PDF / Image</strong> of the marks sheet.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                            <span>Copy the prompt below and paste it into Gemini, then press Enter.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" />
                            <span>Gemini will output a table — <strong className="text-white">copy the entire table.</strong></span>
                        </li>
                    </ol>

                    {/* Prompt Box */}
                    <div className="mt-4 rounded-xl border border-purple-500/20 bg-slate-900/80 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/20 bg-purple-900/20">
                            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Gemini Prompt</span>
                            <button
                                onClick={handleCopy}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                            >
                                {copied ? (
                                    <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</>
                                ) : (
                                    <><Copy className="w-3.5 h-3.5" /> Copy Prompt</>
                                )}
                            </button>
                        </div>
                        <pre className="text-[11px] text-slate-300 p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                            {GEMINI_PROMPT}
                        </pre>
                    </div>
                </StepCard>

                {/* Arrow */}
                <Arrow />

                {/* STEP 2 */}
                <StepCard step={2} icon={FileUp} title="Paste Table into Excel" color="border-blue-500/30" bg="bg-blue-950/20" iconBg="bg-blue-500/20" iconColor="text-blue-400" badge="bg-blue-500">
                    <ol className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                            <span>Open a <strong className="text-white">blank Excel sheet.</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                            <span>Click on <strong className="text-white">Cell A1</strong> and paste the table Gemini generated.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                            <span>Result: <strong className="text-white">Column A</strong> = Roll Numbers (11-digit) &nbsp;|&nbsp; <strong className="text-white">Column B</strong> = Final Marks.</span>
                        </li>
                    </ol>
                </StepCard>

                {/* Arrow */}
                <Arrow />

                {/* STEP 3 */}
                <StepCard step={3} icon={MousePointerClick} title="Install SmartPaste & Validate" color="border-amber-500/30" bg="bg-amber-950/20" iconBg="bg-amber-500/20" iconColor="text-amber-400" badge="bg-amber-500">
                    <p className="text-sm text-slate-400 mb-4">Download and install the SmartPaste tool if you haven't already.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        {/* File 1 */}
                        <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4">
                            <div className="text-xs font-semibold text-amber-300 mb-1 uppercase tracking-wider">File 1 — Extension Installer</div>
                            <p className="text-xs text-slate-400 mb-3">Download and run the installer to activate SmartPaste in Excel.</p>
                            <a
                                href="https://drive.google.com/uc?export=download&id=1BMaMns1fsTlPH529-dIzkLJvEKU7yYif"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Download &amp; Install
                            </a>
                        </div>

                        {/* File 2 */}
                        <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4">
                            <div className="text-xs font-semibold text-amber-300 mb-1 uppercase tracking-wider">File 2 — SmartPaste Script</div>
                            <p className="text-xs text-slate-400 mb-3">Download this file then <strong className="text-white">double-click</strong> it to activate.</p>
                            <a
                                href="https://drive.google.com/uc?export=download&id=1lyhUv_ORSxwfyaOAXD5JUjkhMPVBgvOQ"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Download &amp; Double-click
                            </a>
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4 space-y-2">
                        <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Validate Roll Numbers in ERP</div>
                        <div className="flex items-start gap-2 text-sm text-slate-300">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                            <span>In Excel, select <strong className="text-white">Column A</strong> (Roll Numbers) and press <Kbd>Ctrl+Shift+C</Kbd> to smart-copy.</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-slate-300">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                            <span>Open the ERP marks portal in your browser.</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-slate-300">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                            <span>Press <Kbd>Ctrl+Shift+F</Kbd> (Forward Check) — all roll numbers should match the ERP list top to bottom.</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-slate-300">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                            <span>Press <Kbd>Ctrl+Shift+R</Kbd> (Reverse Check) — verify from bottom to top as well.</span>
                        </div>
                    </div>
                </StepCard>

                {/* Arrow */}
                <Arrow />

                {/* STEP 4 */}
                <StepCard step={4} icon={KeyboardIcon} title="Auto-Fill Marks in ERP" color="border-green-500/30" bg="bg-green-950/20" iconBg="bg-green-500/20" iconColor="text-green-400" badge="bg-green-500">
                    <ol className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                            <span>In Excel, select <strong className="text-white">Column B</strong> (Final Marks) and press <Kbd>Ctrl+Shift+C</Kbd> to smart-copy.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                            <span>On the ERP portal, click into the <strong className="text-white">very first marks entry box.</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                            <span>Press <Kbd>Ctrl+Shift+V</Kbd> — all marks will be auto-filled down the page instantly.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
                            <span>Review and <strong className="text-white">submit</strong> on the ERP portal. Done! ✅</span>
                        </li>
                    </ol>
                </StepCard>

            </div>

            {/* Bottom spacer */}
            <div className="h-16" />
        </div>
    );
}

// Step Card
function StepCard({ step, icon: Icon, title, color, bg, iconBg, iconColor, badge, children }: any) {
    return (
        <div className={`rounded-2xl border ${color} ${bg} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-5 py-4 border-b ${color} bg-black/20`}>
                <span className={`w-7 h-7 rounded-full ${badge} flex items-center justify-center text-xs font-bold text-white shrink-0`}>{step}</span>
                <div className={`p-1.5 rounded-lg ${iconBg}`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h2 className="font-bold text-white text-base">{title}</h2>
            </div>
            <div className="p-5">
                {children}
            </div>
        </div>
    );
}

// Arrow divider
function Arrow() {
    return (
        <div className="flex justify-center">
            <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-700" />
                <ChevronRight className="w-6 h-6 text-slate-500 rotate-90" />
                <div className="w-px h-4 bg-slate-700" />
            </div>
        </div>
    );
}

// Keyboard shortcut badge
function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-slate-800 border border-slate-600 text-[11px] font-mono text-slate-200 leading-none">
            {children}
        </kbd>
    );
}
