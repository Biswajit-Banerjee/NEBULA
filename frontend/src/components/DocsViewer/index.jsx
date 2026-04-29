import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import axios from 'axios';
import {
  X, BookOpen, ChevronRight, ChevronDown, Search, ArrowLeft, FileText, Loader2,
  Minus, Plus, Sun, Moon,
} from 'lucide-react';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';

const FONT_SIZES = [
  { label: 'S', class: 'prose-sm', px: 14 },
  { label: 'M', class: 'prose-base', px: 16 },
  { label: 'L', class: 'prose-lg', px: 18 },
  { label: 'XL', class: 'prose-xl', px: 20 },
];

const VIEW_SLUG_MAP = {
  table: 'view-table',
  network2d: 'view-network-2d',
  network3d: 'view-network-3d',
  map: 'view-map',
  tree: 'view-backtrace',
};

const DocsViewer = ({ isOpen, onClose, initialSlug }) => {
  const { dark, toggle: toggleTheme } = useContext(ThemeContext);
  const [manifest, setManifest] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Resolve which slug to open
  const targetSlug = initialSlug
    ? (VIEW_SLUG_MAP[initialSlug] || initialSlug)
    : null;

  // Fetch manifest on open
  useEffect(() => {
    if (!isOpen) return;
    if (manifest) {
      // Manifest already loaded — just navigate to the target slug
      if (targetSlug && targetSlug !== activePage) {
        loadPage(targetSlug);
      }
      return;
    }
    axios.get('/api/docs/manifest')
      .then(res => {
        setManifest(res.data);
        const slug = targetSlug || res.data?.sections?.[0]?.pages?.[0]?.slug;
        if (slug) loadPage(slug);
      })
      .catch(() => setError('Failed to load documentation index.'));
  }, [isOpen, targetSlug]);

  const loadPage = useCallback((slug) => {
    setLoading(true);
    setError(null);
    axios.get(`/api/docs/${slug}`)
      .then(res => {
        setPageContent(res.data.content);
        setActivePage(slug);
      })
      .catch(() => setError(`Page "${slug}" not found.`))
      .finally(() => setLoading(false));
  }, []);

  const toggleSection = (category) => {
    setCollapsedSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Filter pages by search query
  const filteredSections = useMemo(() => {
    if (!manifest?.sections) return [];
    if (!searchQuery.trim()) return manifest.sections;
    const q = searchQuery.toLowerCase();
    return manifest.sections
      .map(section => ({
        ...section,
        pages: section.pages.filter(p =>
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        ),
      }))
      .filter(section => section.pages.length > 0);
  }, [manifest, searchQuery]);

  // Find current page info for breadcrumb
  const currentPageInfo = useMemo(() => {
    if (!manifest?.sections || !activePage) return null;
    for (const section of manifest.sections) {
      const page = section.pages.find(p => p.slug === activePage);
      if (page) return { category: section.category, ...page };
    }
    return null;
  }, [manifest, activePage]);

  // Custom components for ReactMarkdown
  const markdownComponents = useMemo(() => ({
    // Rewrite image src to use /docs-assets/ prefix for relative paths
    img: ({ node, src, alt, ...props }) => {
      const resolvedSrc = src && !src.startsWith('http') && !src.startsWith('/')
        ? `/docs-assets/${src.replace(/^images\//, '')}`
        : src;
      return (
        <img
          src={resolvedSrc}
          alt={alt || ''}
          className="rounded-lg shadow-md max-w-full my-4"
          loading="lazy"
          {...props}
        />
      );
    },
    // Internal doc links: click to navigate within the viewer
    a: ({ node, href, children, ...props }) => {
      const isInternal = href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:');
      if (isInternal) {
        return (
          <button
            onClick={(e) => { e.preventDefault(); loadPage(href); }}
            className="text-violet-600 dark:text-violet-400 hover:underline font-medium cursor-pointer"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
  }), [loadPage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Sidebar header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-violet-500" />
              <span className="font-bold text-lg text-slate-800 dark:text-slate-100">NEBULA Docs</span>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredSections.map((section) => {
              const isCollapsed = collapsedSections[section.category];
              return (
                <div key={section.category}>
                  <button
                    onClick={() => toggleSection(section.category)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />
                    }
                    {section.category}
                  </button>
                  {!isCollapsed && (
                    <div className="ml-2 space-y-0.5">
                      {section.pages.map((page) => (
                        <button
                          key={page.slug}
                          onClick={() => loadPage(page.slug)}
                          className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            activePage === page.slug
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{page.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredSections.length === 0 && (
              <p className="text-sm text-slate-400 italic px-2 py-4">No pages match your filter.</p>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <BookOpen className="w-4 h-4" />
            </button>
            {/* Breadcrumb */}
            {currentPageInfo && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-400 dark:text-slate-500">{currentPageInfo.category}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                <span className="text-slate-700 dark:text-slate-200 font-medium">{currentPageInfo.title}</span>
              </div>
            )}
          </div>

          {/* Controls: font size + theme + close */}
          <div className="flex items-center gap-1">
            {/* Font size */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5">
              <button
                onClick={() => setFontSizeIdx(i => Math.max(0, i - 1))}
                disabled={fontSizeIdx === 0}
                className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Decrease font size"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-5 text-center select-none">
                {FONT_SIZES[fontSizeIdx].label}
              </span>
              <button
                onClick={() => setFontSizeIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))}
                disabled={fontSizeIdx === FONT_SIZES.length - 1}
                className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Increase font size"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-violet-500" />}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/50 mx-0.5" />

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-colors"
              title="Close documentation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            )}
            {error && (
              <div className="text-center py-20">
                <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => { setError(null); setActivePage(null); }}
                  className="text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to index
                </button>
              </div>
            )}
            {!loading && !error && pageContent && (
              <article className={`prose prose-slate dark:prose-invert ${FONT_SIZES[fontSizeIdx].class} prose-headings:scroll-mt-20 prose-img:rounded-lg prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:dark:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm max-w-none`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  components={markdownComponents}
                >
                  {pageContent}
                </ReactMarkdown>
              </article>
            )}
            {!loading && !error && !pageContent && !activePage && (
              <div className="text-center py-20">
                <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">NEBULA Documentation</h2>
                <p className="text-slate-500 dark:text-slate-400">Select a page from the sidebar to get started.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DocsViewer;
