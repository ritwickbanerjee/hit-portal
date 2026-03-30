'use client';

import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface LatexRendererProps {
    content: string;
    className?: string;
}

export default function LatexRenderer({ content, className = '' }: LatexRendererProps) {
    if (!content) return null;
    return (
        <div className={`latex-content ${className}`}>
            <Latex>{content}</Latex>
        </div>
    );
}
