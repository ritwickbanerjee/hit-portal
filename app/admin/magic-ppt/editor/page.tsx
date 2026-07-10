'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronLeft, ChevronRight, Type, Code, MousePointer2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SelectedElement {
    id: string;
    text: string;
    tagName: string;
}

export default function MagicPPTEditor() {
    const [iframeHtml, setIframeHtml] = useState('');
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const visualEditorScript = `
<script id="magic-ppt-editor-script">
    document.addEventListener('click', (e) => {
        let target = e.target;
        
        // Skip buttons (navigation)
        if (target.closest('button')) return;

        // Bubble up to find a suitable text container
        while (target && target !== document.body && !target.tagName.match(/^(H[1-6]|P|LI|SPAN|DIV)$/)) {
            target = target.parentElement;
        }
        
        if (!target || target === document.body) return;
        
        // If it's a huge structural DIV, ignore it
        if (target.tagName === 'DIV' && target.innerText.length > 500 && target.children.length > 3) return;

        e.preventDefault();
        e.stopPropagation();

        if (!target.dataset.magicId) {
            target.dataset.magicId = 'magic-' + Math.random().toString(36).substr(2, 9);
        }

        // Clear old selection
        document.querySelectorAll('.magic-selected').forEach(el => {
            el.classList.remove('magic-selected');
            el.style.outline = 'none';
        });

        // Highlight new selection
        target.classList.add('magic-selected');
        target.style.outline = '3px solid #818cf8';
        target.style.outlineOffset = '2px';
        target.style.borderRadius = '4px';

        // If they click on the background, deselect
        if (target.id === 'app' || target === document.body) {
            window.parent.postMessage({ type: 'ELEMENT_DESELECTED' }, '*');
        }

        window.parent.postMessage({
            type: 'ELEMENT_SELECTED',
            id: target.dataset.magicId,
            text: target.innerHTML,
            tagName: target.tagName
        }, '*');
    }, true);

    // Force presentation scripts (like resize) to initialize
    // because iframe srcDoc dynamic updates might miss the native window.onload
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('load'));
    }, 100);
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 1000);

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'UPDATE_ELEMENT') {
            const el = document.querySelector('[data-magic-id="' + e.data.id + '"]');
            if (el) {
                el.innerHTML = e.data.text;
                if (window.renderMathInElement) window.renderMathInElement(el);
                
                // Cleanup highlights before saving
                const clone = document.documentElement.cloneNode(true);
                clone.querySelectorAll('.magic-selected').forEach(node => {
                    node.classList.remove('magic-selected');
                    node.style.outline = '';
                    node.style.outlineOffset = '';
                    node.style.borderRadius = '';
                });
                
                window.parent.postMessage({
                    type: 'HTML_UPDATE',
                    html: clone.outerHTML
                }, '*');
            }
        }
    });
</script>
`;

    useEffect(() => {
        const draft = localStorage.getItem('magic_ppt_draft');
        if (draft) {
            // Strip ONLY the previously injected editor script, keep all other native presentation scripts!
            const clean = draft.replace(/<script id="magic-ppt-editor-script"[\s\S]*?<\/script>/gi, '');
            setIframeHtml(clean + visualEditorScript);
        } else {
            toast.error('No presentation draft found.');
        }
    }, []);

    // Listen for messages from iframe
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (!e.data) return;
            
            if (e.data.type === 'ELEMENT_SELECTED') {
                setSelectedElement({
                    id: e.data.id,
                    text: e.data.text,
                    tagName: e.data.tagName
                });
            } else if (e.data.type === 'HTML_UPDATE') {
                // Update local storage in background without reloading iframe
                localStorage.setItem('magic_ppt_draft', e.data.html);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleTextChange = (newText: string) => {
        if (!selectedElement) return;
        
        // Update local state for fast typing
        setSelectedElement(prev => prev ? { ...prev, text: newText } : null);
        
        // Send update to iframe immediately
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'UPDATE_ELEMENT',
                id: selectedElement.id,
                text: newText
            }, '*');
        }
    };

    const handleDownload = () => {
        const draft = localStorage.getItem('magic_ppt_draft');
        if (!draft) return;
        
        try {
            // Strip our visual editor script before downloading
            const finalHtml = draft.replace(/<script id="magic-ppt-editor-script"[\s\S]*?<\/script>/gi, '');
            const blob = new Blob([finalHtml], { type: 'text/html' });
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
        <div className="flex flex-col w-full h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            {/* ── HEADER ── */}
            <header className="flex-shrink-0 h-14 border-b border-white/10 flex items-center px-4 justify-between bg-slate-900/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.close()}
                        className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <h1 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                        Magic PPT Visual Editor
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 mr-2">
                        Changes auto-save instantly
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
                {/* Left: Property Inspector */}
                {isPanelOpen && (
                    <div className="w-[380px] shrink-0 h-full flex flex-col border-r border-white/10 bg-slate-900/50 transition-all duration-300">
                        <div className="h-12 shrink-0 flex items-center px-4 border-b border-white/5 bg-slate-900/80">
                            <Type className="w-4 h-4 text-indigo-400 mr-2" />
                            <span className="text-sm font-semibold text-slate-200">Properties</span>
                            <div className="flex-1" />
                            <button onClick={() => setIsPanelOpen(false)} className="text-slate-400 hover:text-white transition-colors" title="Close Panel">
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex-1 p-5 overflow-y-auto">
                            {!selectedElement ? (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4 text-slate-500">
                                    <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-white/5">
                                        <MousePointer2 className="w-6 h-6 text-indigo-400/50" />
                                    </div>
                                    <p className="text-sm">Click on any text or mathematical equation in the preview to edit it here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                Edit Text Content
                                            </label>
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">
                                                &lt;{selectedElement.tagName.toLowerCase()}&gt;
                                            </span>
                                        </div>
                                        <textarea
                                            value={selectedElement.text}
                                            onChange={(e) => handleTextChange(e.target.value)}
                                            className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar shadow-inner"
                                            placeholder="Enter text..."
                                        />
                                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                                            <strong>Tip:</strong> You can use standard HTML tags like <code className="text-indigo-300">&lt;strong&gt;</code> or <code className="text-indigo-300">&lt;br&gt;</code> here. For math, wrap equations in <code className="text-indigo-300">\( \)</code> for inline and <code className="text-indigo-300">\[ \]</code> for block equations.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Right: Live Preview */}
                <div className="flex-1 h-full flex flex-col bg-black relative transition-all duration-300">
                    <div className="h-10 shrink-0 bg-slate-900/60 flex items-center px-4 border-b border-white/10 z-10 shadow-sm gap-2">
                        {!isPanelOpen && (
                            <button onClick={() => setIsPanelOpen(true)} className="text-slate-400 hover:text-white transition-colors" title="Open Panel">
                                <PanelLeftOpen className="w-4 h-4" />
                            </button>
                        )}
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Preview (Click anywhere to inspect)
                        </span>
                    </div>
                    <div className="flex-1 relative w-full h-full bg-[#0a0a0a]">
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
