'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MagicPPTEditor() {
    const [editorHtml, setEditorHtml] = useState('');
    const [iframeHtml, setIframeHtml] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Load from local storage
    useEffect(() => {
        const draft = localStorage.getItem('magic_ppt_draft');
        if (draft) {
            setEditorHtml(draft);
            setIframeHtml(draft);
        } else {
            toast.error('No presentation draft found.');
        }
    }, []);

    // Listen to WYSIWYG changes from the iframe
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'HTML_UPDATE' && e.data.html) {
                // The WYSIWYG editor inside the iframe sent updated HTML
                setEditorHtml(e.data.html);
                setIframeHtml(e.data.html);
                localStorage.setItem('magic_ppt_draft', e.data.html);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 1-second Debounce for manual editor changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (editorHtml !== iframeHtml) {
                setIframeHtml(editorHtml);
                localStorage.setItem('magic_ppt_draft', editorHtml);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [editorHtml, iframeHtml]);

    const handleDownload = () => {
        try {
            const blob = new Blob([editorHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'presentation.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Downloaded successfully!');
        } catch (e) {
            toast.error('Failed to download');
        }
    };

    return (
        <div className="flex flex-col w-full h-screen bg-[#0a0a0a] text-slate-200 overflow-hidden font-sans">
            {/* ── HEADER ── */}
            <header className="flex-shrink-0 h-14 border-b border-white/10 flex items-center px-4 justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.close()}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Close Editor
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <h1 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                        Magic PPT Live Editor
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-[10px] text-indigo-300 border border-indigo-500/20">
                            Split View
                        </span>
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 mr-2">
                        Autosaved to LocalStorage
                    </span>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Download className="w-4 h-4" />
                        Download HTML
                    </button>
                </div>
            </header>

            {/* ── SPLIT VIEW ── */}
            <main className="flex-1 flex w-full h-[calc(100vh-56px)]">
                {/* Left: Code Editor */}
                <div className="w-1/2 h-full flex flex-col border-r border-white/10 bg-[#1e1e1e]">
                    <div className="h-8 shrink-0 bg-[#2d2d2d] flex items-center px-4 border-b border-white/5">
                        <span className="text-xs font-mono text-slate-400">Raw HTML (Editable)</span>
                        <div className="flex-1" />
                        <span className="text-[10px] text-slate-500">Updates preview in 1s</span>
                    </div>
                    <textarea
                        value={editorHtml}
                        onChange={(e) => setEditorHtml(e.target.value)}
                        spellCheck="false"
                        className="flex-1 w-full p-4 bg-transparent text-slate-300 font-mono text-xs leading-relaxed resize-none focus:outline-none custom-scrollbar"
                        placeholder="<html>..."
                    />
                </div>

                {/* Right: Live Preview */}
                <div className="w-1/2 h-full flex flex-col bg-black relative">
                    <div className="h-8 shrink-0 bg-slate-900/60 flex items-center px-4 border-b border-white/10">
                        <span className="text-xs font-medium text-slate-400">Live Preview (Click text to edit)</span>
                    </div>
                    <div className="flex-1 relative w-full h-full">
                        <iframe
                            ref={iframeRef}
                            srcDoc={iframeHtml}
                            className="absolute inset-0 w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin"
                            title="Live Preview"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
