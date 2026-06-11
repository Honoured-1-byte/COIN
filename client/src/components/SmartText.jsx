import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Custom renderer to handle "Code Blocks" vs "Regular Text" nicely
export default function SmartText({ content, className = "" }) {
    return (
        <div className={`prose prose-invert prose-sm max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Fix for "paragraph" spacing in streaming text
                    p: ({ node, ...props }) => <p className="mb-2 leading-relaxed break-words" {...props} />,
                    // Style code blocks (Option 1 Preview)
                    code: ({ node, inline, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                            <div className="bg-slate-950 rounded border border-slate-800 p-2 my-2 overflow-x-auto">
                                <code className={className} {...props}>{children}</code>
                            </div>
                        ) : (
                            <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-200 text-xs" {...props}>{children}</code>
                        )
                    },
                    // Table Styling
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border border-slate-700 rounded-lg">
                            <table className="min-w-full border-collapse bg-slate-900/40 text-sm" {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => (
                        <thead className="bg-slate-800/80 text-cyan-400 font-mono uppercase tracking-wider text-xs border-b border-slate-600" {...props} />
                    ),
                    tbody: ({ node, ...props }) => (
                        <tbody className="divide-y divide-slate-800" {...props} />
                    ),
                    tr: ({ node, ...props }) => (
                        <tr className="hover:bg-white/5 transition-colors" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                        <th className="px-4 py-3 text-left font-bold border-r border-slate-700 last:border-r-0" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                        <td className="px-4 py-3 border-r border-slate-800/50 last:border-r-0 text-slate-300" {...props} />
                    )
                }}
            >
                {/* Pre-process: Ensure $$ LaTeX syntax has spaces for parser */}
                {content?.replace(/\$\$/g, '\n$$$\n')}
            </ReactMarkdown>
        </div>
    );
}
