import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import axios from 'axios';
import {
  X, BookOpen, ChevronRight, ChevronDown, ChevronLeft, Search, ArrowLeft, FileText, Loader2, PanelLeft, ListTree,
} from 'lucide-react';
import { getApiUrl } from '../../config/api';
import ThemeSelector from '../ThemeProvider/ThemeSelector';
import TextSizeControl from '../TextSize/TextSizeControl';
import KeyPanel from '../Key/KeyPanel';
import Glyph from '../Key/Glyphs';
import { useTextScale } from '../../lib/textScale';

/** App view ids -> documentation slugs. */
export const VIEW_SLUG_MAP = {
  table: 'view-metabolome-records',
  tree: 'view-path-finder',
  map: 'view-metabolic-map',
  network2d: 'view-reaction-network',
};

const slugify = (text) => String(text)
  .toLowerCase()
  .replace(/`|\*|_|\[|\]|\(.*?\)/g, '')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .trim()
  .replace(/\s+/g, '-');

const nodeText = (children) => React.Children.toArray(children)
  .map((c) => (typeof c === 'string' ? c : c?.props?.children ? nodeText(c.props.children) : ''))
  .join('');

/** Pull h2/h3 headings out of markdown for the "On this page" outline. */
const extractOutline = (md) => {
  const out = [];
  let fenced = false;
  md.split(/\r?\n/).forEach((line) => {
    if (/^```/.test(line)) fenced = !fenced;
    if (fenced) return;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const text = m[2].replace(/`|\*\*|\*|\[([^\]]*)\]\([^)]*\)/g, '$1');
      out.push({ level: m[1].length, text, id: slugify(m[2]) });
    }
  });
  return out;
};

const splitHref = (href = '') => {
  const [slug, anchor] = href.split('#');
  return { slug, anchor };
};

const CITE_RE = /^\[\d+(?:[,–-]\s*\d+)*\]$/;

const DocsViewer = ({ isOpen, onClose, initialSlug, navKey = 0 }) => {
  const { scale, fontSize } = useTextScale();
  const [manifest, setManifest] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [pageCache, setPageCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [zoomImg, setZoomImg] = useState(null);
  const isResizingRef = useRef(false);
  const scrollRef = useRef(null);
  const pendingAnchor = useRef(null);

  // Sidebar/outline text follows the text scale but is capped so navigation stays usable.
  const chromeScale = Math.min(scale, 1.4);
  const chromeStyle = { fontSize: `${15 * chromeScale}px` };

  const resize = useCallback((e) => {
    if (!isResizingRef.current) return;
    if (e.clientX > 200 && e.clientX < 640) setSidebarWidth(e.clientX);
  }, []);
  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
  }, [resize]);
  const startResizing = useCallback((e) => {
    isResizingRef.current = true;
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    e.preventDefault();
  }, [resize, stopResizing]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoomImg) setZoomImg(null); else onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, zoomImg]);

  const targetSlug = initialSlug ? (VIEW_SLUG_MAP[initialSlug] || initialSlug) : null;

  const scrollToAnchor = useCallback((id) => {
    const el = scrollRef.current?.querySelector(`[id="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const loadPage = useCallback((slug, anchor = null) => {
    pendingAnchor.current = anchor;
    setError(null);
    setLoading(true);
    axios.get(getApiUrl(`docs/${slug}`))
      .then((res) => {
        setPageContent(res.data.content);
        setActivePage(slug);
        setPageCache((c) => ({ ...c, [slug]: res.data.content }));
        scrollRef.current?.scrollTo({ top: 0 });
      })
      .catch(() => setError(`Page "${slug}" not found.`))
      .finally(() => setLoading(false));
  }, []);

  // After a page renders, jump to a pending #anchor.
  useEffect(() => {
    if (loading || !pageContent || !pendingAnchor.current) return;
    const id = pendingAnchor.current;
    pendingAnchor.current = null;
    requestAnimationFrame(() => scrollToAnchor(id));
  }, [loading, pageContent, scrollToAnchor]);

  // Open / navigate
  useEffect(() => {
    if (!isOpen) return;
    const go = (m) => {
      const first = m?.sections?.[0]?.pages?.[0]?.slug;
      const { slug, anchor } = splitHref(targetSlug || first || '');
      if (slug) loadPage(slug, anchor || null);
    };
    if (manifest) { go(manifest); return; }
    axios.get(getApiUrl('docs/manifest'))
      .then((res) => { setManifest(res.data); go(res.data); })
      .catch(() => setError('Failed to load documentation index.'));
  }, [isOpen, targetSlug, navKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazily fetch every page once, for full-text search.
  useEffect(() => {
    if (!isOpen || !manifest) return;
    const slugs = manifest.sections.flatMap((s) => s.pages.map((p) => p.slug)).filter((s) => !(s in pageCache));
    if (!slugs.length) return;
    let cancelled = false;
    Promise.all(slugs.map((s) => axios.get(getApiUrl(`docs/${s}`)).then((r) => [s, r.data.content]).catch(() => [s, ''])))
      .then((entries) => { if (!cancelled) setPageCache((c) => ({ ...Object.fromEntries(entries), ...c })); });
    return () => { cancelled = true; };
  }, [isOpen, manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  const flatPages = useMemo(
    () => (manifest?.sections || []).flatMap((s) => s.pages.map((p) => ({ ...p, category: s.category }))),
    [manifest],
  );
  const currentIdx = flatPages.findIndex((p) => p.slug === activePage);
  const currentPageInfo = currentIdx >= 0 ? flatPages[currentIdx] : null;
  const prevPage = currentIdx > 0 ? flatPages[currentIdx - 1] : null;
  const nextPage = currentIdx >= 0 && currentIdx < flatPages.length - 1 ? flatPages[currentIdx + 1] : null;

  const q = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return null;
    const hits = [];
    flatPages.forEach((p) => {
      const body = pageCache[p.slug] || '';
      const lower = body.toLowerCase();
      const titleHit = p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      const at = lower.indexOf(q);
      if (!titleHit && at < 0) return;
      let snippet = '';
      if (at >= 0) {
        const raw = body.slice(Math.max(0, at - 50), at + q.length + 90).replace(/[#*`>|\n\r]+/g, ' ').trim();
        snippet = `${at > 50 ? '… ' : ''}${raw} …`;
      }
      hits.push({ ...p, snippet, titleHit });
    });
    return hits.sort((a, b) => Number(b.titleHit) - Number(a.titleHit));
  }, [q, flatPages, pageCache]);

  const outline = useMemo(() => extractOutline(pageContent), [pageContent]);

  const navigateHref = useCallback((href) => {
    const { slug, anchor } = splitHref(href);
    if (!slug) { if (anchor) scrollToAnchor(anchor); return; }
    if (slug === activePage) { if (anchor) scrollToAnchor(anchor); return; }
    loadPage(slug, anchor || null);
  }, [activePage, loadPage, scrollToAnchor]);

  const markdownComponents = useMemo(() => {
    const heading = (Tag) => ({ node, children, ...props }) => (
      <Tag id={slugify(nodeText(children))} {...props}>{children}</Tag>
    );
    return {
      h1: heading('h1'), h2: heading('h2'), h3: heading('h3'), h4: heading('h4'),
      img: ({ node, src, alt, title }) => {
        if (src && src.startsWith('sym:')) {
          return <Glyph id={src.slice(4)} title={alt || undefined} className="docs-glyph" />;
        }
        const resolved = src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/')
          ? getApiUrl(`docs-assets/${src.replace(/^images\//, '')}`)
          : src;
        return (
          <span className="docs-figure block">
            <img src={resolved} alt={alt || ''} loading="lazy" onClick={() => setZoomImg({ src: resolved, alt, title })} />
            {title && <span className="docs-caption block">{title}</span>}
          </span>
        );
      },
      p: ({ node, children, ...props }) => {
        const hasFigure = node?.children?.some((c) => c.tagName === 'nebula-key' || (c.tagName === 'img' && !(c.properties?.src || '').startsWith('sym:')));
        return hasFigure ? <div {...props}>{children}</div> : <p {...props}>{children}</p>;
      },
      blockquote: ({ node, children }) => {
        const text = nodeText(children).trim().toLowerCase();
        const kind = /^tip\b/.test(text) ? 'tip' : /^note\b/.test(text) ? 'note'
          : /^(warning|caution|important)\b/.test(text) ? 'warning' : /^example\b/.test(text) ? 'example' : 'note';
        return <blockquote className="docs-callout" data-kind={kind}>{children}</blockquote>;
      },
      a: ({ node, href, children, ...props }) => {
        if (!href) return <a {...props}>{children}</a>;
        const isExternal = href && /^(https?:|mailto:)/.test(href);
        if (!isExternal) {
          const text = nodeText(children);
          const isCite = CITE_RE.test(text.trim());
          return (
            <a
              href={`#${href}`}
              onClick={(e) => { e.preventDefault(); navigateHref(href || ''); }}
              className={isCite ? 'docs-cite' : undefined}
              title={isCite ? 'Go to reference' : undefined}
            >
              {children}
            </a>
          );
        }
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      },
      'nebula-key': ({ node }) => <KeyPanel view={node?.properties?.view || node?.properties?.dataView} />,
    };
  }, [navigateHref]);

  const toggleSection = (category) => setCollapsedSections((prev) => ({ ...prev, [category]: !prev[category] }));

  if (!isOpen) return null;

  const navItem = (page, extra) => (
    <button
      key={page.slug}
      onClick={() => { setSearchQuery(''); loadPage(page.slug); }}
      className={`w-full text-left flex items-start gap-2 px-3 py-1.5 rounded-lg transition-colors ${
        activePage === page.slug ? 'bg-brand/15 text-link font-semibold' : 'text-content-secondary hover:bg-surface-inset hover:text-content'
      }`}
    >
      <FileText className="mt-[0.2em] h-[1em] w-[1em] flex-shrink-0" />
      <span className="min-w-0">
        <span className="block break-words">{page.title}</span>
        {extra}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex bg-surface text-content" role="dialog" aria-label="NEBULA documentation">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 transition-[width] duration-200 overflow-hidden border-r border-brd bg-surface-secondary relative"
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        {sidebarOpen && (
          <div onMouseDown={startResizing} className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-brand/30 transition-colors z-50" />
        )}
        <div className="h-full flex flex-col" style={{ width: `${sidebarWidth}px`, ...chromeStyle }}>
          <div className="p-4 border-b border-brd">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-[1.3em] w-[1.3em] text-brand" />
              <span className="font-bold text-content" style={{ fontSize: '1.2em' }}>NEBULA Docs</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[0.95em] w-[0.95em] text-content-muted" />
              <input
                type="search"
                placeholder="Search the documentation…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search the documentation"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-brd bg-surface text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Documentation pages">
            {searchResults ? (
              <>
                <p className="px-2 pb-1 text-content-muted" style={{ fontSize: '0.8em' }}>
                  {searchResults.length} page{searchResults.length === 1 ? '' : 's'} match “{searchQuery}”
                </p>
                {searchResults.map((p) => navItem(p, (
                  <span className="block text-content-muted leading-snug" style={{ fontSize: '0.82em' }}>{p.snippet || p.description}</span>
                )))}
                {searchResults.length === 0 && <p className="px-2 py-4 text-content-muted italic">No pages match.</p>}
              </>
            ) : (
              (manifest?.sections || []).map((section) => {
                const isCollapsed = collapsedSections[section.category];
                return (
                  <div key={section.category}>
                    <button
                      onClick={() => toggleSection(section.category)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 font-bold uppercase tracking-wider text-content-secondary hover:text-content transition-colors"
                      style={{ fontSize: '0.78em' }}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronRight className="h-[1.1em] w-[1.1em]" /> : <ChevronDown className="h-[1.1em] w-[1.1em]" />}
                      {section.category}
                    </button>
                    {!isCollapsed && <div className="ml-2 space-y-0.5">{section.pages.map((p) => navItem(p))}</div>}
                  </div>
                );
              })
            )}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-brd bg-surface-overlay">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-surface-inset text-content-secondary transition-colors"
              title={sidebarOpen ? 'Hide page list' : 'Show page list'}
              aria-label={sidebarOpen ? 'Hide page list' : 'Show page list'}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            {currentPageInfo && (
              <div className="flex items-center gap-1.5 text-sm min-w-0">
                <span className="text-content-muted hidden sm:inline">{currentPageInfo.category}</span>
                <ChevronRight className="w-3.5 h-3.5 text-content-muted hidden sm:inline flex-shrink-0" />
                <span className="text-content font-semibold truncate">{currentPageInfo.title}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TextSizeControl />
            <button
              onClick={() => setOutlineOpen((o) => !o)}
              className={`hidden xl:inline-flex p-1.5 rounded-lg hover:bg-surface-inset transition-colors ${outlineOpen ? 'text-brand' : 'text-content-secondary'}`}
              title={outlineOpen ? 'Hide “On this page”' : 'Show “On this page”'}
              aria-label="Toggle on-this-page outline"
            >
              <ListTree className="w-4 h-4" />
            </button>
            <ThemeSelector />
            <div className="w-px h-5 bg-brd mx-0.5" />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-inset text-content-secondary transition-colors" title="Close documentation (Esc)" aria-label="Close documentation">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          <div ref={scrollRef} className="flex-1 overflow-y-auto" data-docs-scroll>
            <div className="mx-auto px-6 py-8" style={{ maxWidth: `${46 * Math.min(scale, 1.6) + 6}em`, fontSize: '16px' }}>
              {loading && (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-brand animate-spin" /></div>
              )}
              {error && (
                <div className="text-center py-20">
                  <p className="text-err mb-4">{error}</p>
                  <button onClick={() => { setError(null); loadPage(flatPages[0]?.slug || 'introduction'); }} className="text-sm text-link hover:underline flex items-center gap-1 mx-auto">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to the start
                  </button>
                </div>
              )}
              {!loading && !error && pageContent && (
                <>
                  <article className="docs-prose prose prose-base max-w-none" style={fontSize}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeHighlight]}
                      components={markdownComponents}
                      urlTransform={(url) => (url.startsWith('sym:') ? url : defaultUrlTransform(url))}
                    >
                      {pageContent}
                    </ReactMarkdown>
                  </article>
                  <nav className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3" style={chromeStyle} aria-label="Previous and next page">
                    {prevPage ? (
                      <button onClick={() => loadPage(prevPage.slug)} className="text-left rounded-xl border border-brd p-3 hover:border-brand hover:bg-brand/5 transition-colors">
                        <span className="flex items-center gap-1 text-content-muted" style={{ fontSize: '0.8em' }}><ChevronLeft className="h-[1em] w-[1em]" /> Previous</span>
                        <span className="block font-semibold text-content">{prevPage.title}</span>
                      </button>
                    ) : <span />}
                    {nextPage && (
                      <button onClick={() => loadPage(nextPage.slug)} className="text-right rounded-xl border border-brd p-3 hover:border-brand hover:bg-brand/5 transition-colors">
                        <span className="flex items-center justify-end gap-1 text-content-muted" style={{ fontSize: '0.8em' }}>Next <ChevronRight className="h-[1em] w-[1em]" /></span>
                        <span className="block font-semibold text-content">{nextPage.title}</span>
                      </button>
                    )}
                  </nav>
                </>
              )}
              {!loading && !error && !pageContent && (
                <div className="text-center py-20">
                  <BookOpen className="w-12 h-12 text-content-muted mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-content mb-2">NEBULA Documentation</h2>
                  <p className="text-content-secondary">Select a page from the list to get started.</p>
                </div>
              )}
            </div>
          </div>

          {outlineOpen && outline.length > 0 && !loading && (
            <aside className="hidden xl:block w-64 flex-shrink-0 overflow-y-auto border-l border-brd bg-surface-secondary/60 p-4" style={chromeStyle} aria-label="On this page">
              <p className="mb-2 font-bold uppercase tracking-wider text-content-muted" style={{ fontSize: '0.75em' }}>On this page</p>
              <ul className="space-y-0.5">
                {outline.map((h) => (
                  <li key={`${h.id}-${h.level}`}>
                    <button
                      onClick={() => scrollToAnchor(h.id)}
                      className={`w-full text-left py-0.5 text-content-secondary hover:text-brand leading-snug ${h.level === 3 ? 'pl-4' : 'font-medium'}`}
                      style={{ fontSize: h.level === 3 ? '0.9em' : '0.95em' }}
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </main>

      {zoomImg && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 p-6" onClick={() => setZoomImg(null)}>
          <img src={zoomImg.src} alt={zoomImg.alt || ''} className="max-h-[85vh] max-w-full rounded-lg shadow-2xl" />
          {(zoomImg.title || zoomImg.alt) && <p className="mt-3 max-w-3xl text-center text-sm text-white/90">{zoomImg.title || zoomImg.alt}</p>}
          <button className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close image"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
};

export default DocsViewer;
