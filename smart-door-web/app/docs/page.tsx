'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Copy, Check, Menu, X } from 'lucide-react';
import Link from 'next/link';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      items.push({
        id: slugify(match[2]),
        text: match[2],
        level: match[1].length,
      });
    }
  }
  return items;
}

export default function DocsPage() {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [tocOpen, setTocOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then((res) => res.text())
      .then((text) => {
        setMarkdown(text);
        setLoading(false);
      })
      .catch(() => {
        setMarkdown('# Error\n\nFailed to load API documentation.');
        setLoading(false);
      });
  }, []);

  const toc = useMemo(() => extractToc(markdown), [markdown]);

  // Scroll spy
  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-60px 0px -70% 0px', threshold: 0 }
    );

    const headings = document.querySelectorAll('h2[id], h3[id]');
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc, loading]);

  const handleCopyCode = useCallback((code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(index);
    setTimeout(() => setCopiedBlock(null), 2000);
  }, []);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      setTocOpen(false);
    }
  }, []);

  let codeBlockIndex = 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const tocContent = (
    <nav className="py-5 px-3">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2" style={{ color: 'var(--text-muted)' }}>
        On this page
      </p>
      <ul className="space-y-px">
        {toc.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => scrollToHeading(item.id)}
                className="w-full text-left py-1.5 transition-colors duration-100"
                style={{
                  paddingLeft: item.level === 3 ? '1.75rem' : '0.75rem',
                  borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  color: isActive
                    ? 'var(--primary)'
                    : item.level === 2
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                  fontSize: item.level === 2 ? '13px' : '12px',
                  fontWeight: item.level === 2 ? (isActive ? 600 : 500) : 400,
                }}
              >
                {item.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Compact header */}
      <header
        className="fixed top-0 left-0 right-0 z-40 h-12 px-4 flex items-center gap-3"
        style={{
          background: 'color-mix(in srgb, var(--bg-base) 90%, transparent)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Link
          href="/"
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          API Docs
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {tocOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* Layout: sidebar + content */}
      <div className="pt-12 flex">
        {/* Desktop TOC — fixed */}
        <aside
          className="hidden lg:block fixed top-12 left-0 w-60 xl:w-64 h-[calc(100vh-48px)] overflow-y-auto"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          {tocContent}
        </aside>

        {/* Mobile TOC overlay */}
        {tocOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setTocOpen(false)}
            />
            <aside
              className="fixed top-12 left-0 z-30 w-72 h-[calc(100vh-48px)] overflow-y-auto lg:hidden"
              style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
            >
              {tocContent}
            </aside>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 lg:ml-60 xl:ml-64">
          <div ref={contentRef} className="max-w-3xl mx-auto px-5 md:px-8 py-8 pb-20">
            <ReactMarkdown
              components={{
                h1: ({ children }) => {
                  const text = String(children);
                  const id = slugify(text);
                  return (
                    <h1 id={id} className="text-2xl md:text-3xl font-bold mt-2 mb-6 scroll-mt-16"
                      style={{ color: 'var(--text-primary)' }}>
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const text = String(children);
                  const id = slugify(text);
                  return (
                    <h2 id={id} className="text-lg md:text-xl font-bold mt-12 mb-4 pt-6 scroll-mt-16"
                      style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border)' }}>
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const text = String(children);
                  const id = slugify(text);
                  return (
                    <h3 id={id} className="text-base font-semibold mt-8 mb-3 scroll-mt-16"
                      style={{ color: 'var(--text-primary)' }}>
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>
                ),
                code: ({ className, children }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    const currentIndex = codeBlockIndex++;
                    const codeText = String(children).replace(/\n$/, '');
                    const lang = className?.replace('language-', '') || 'text';
                    return (
                      <div className="my-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between px-3 py-1.5"
                          style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border)' }}>
                          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {lang}
                          </span>
                          <button
                            onClick={() => handleCopyCode(codeText, currentIndex)}
                            className="p-1 rounded transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {copiedBlock === currentIndex
                              ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                              : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <pre className="px-4 py-3 overflow-x-auto text-[13px] leading-relaxed" style={{ background: '#0d1117', color: '#c9d1d9' }}>
                          <code>{codeText}</code>
                        </pre>
                      </div>
                    );
                  }
                  return (
                    <code
                      className="px-1 py-0.5 rounded text-[13px] font-mono"
                      style={{ background: 'var(--bg-surface-hover)', color: 'var(--primary)' }}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                hr: () => <hr className="my-8 border-none h-px" style={{ background: 'var(--border)' }} />,
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-4 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</li>
                ),
                a: ({ href, children }) => (
                  <a href={href} className="underline underline-offset-2 decoration-1 hover:opacity-80 transition-opacity" style={{ color: 'var(--primary)' }}>{children}</a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="pl-4 my-4 py-0.5" style={{ borderLeft: '3px solid var(--primary)', color: 'var(--text-muted)' }}>
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: 'var(--bg-surface-hover)' }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {children}
                  </td>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
