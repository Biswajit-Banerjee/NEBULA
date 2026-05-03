/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        // You could add a 'serif' or 'mono' stack here if needed
      },
      colors: {
        // ── Theme-aware semantic tokens (CSS custom properties) ──
        surface: {
          DEFAULT:   'rgb(var(--surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--surface-secondary) / <alpha-value>)',
          elevated:  'rgb(var(--surface-elevated) / <alpha-value>)',
          overlay:   'rgb(var(--surface-overlay) / <alpha-value>)',
          inset:     'rgb(var(--surface-inset) / <alpha-value>)',
        },
        content: {
          DEFAULT:   'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--text-muted) / <alpha-value>)',
          inverse:   'rgb(var(--text-inverse) / <alpha-value>)',
        },
        brd: {
          DEFAULT:   'rgb(var(--border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--border-secondary) / <alpha-value>)',
          focus:     'rgb(var(--border-focus) / <alpha-value>)',
        },
        brand: {
          DEFAULT:   'rgb(var(--brand-primary) / <alpha-value>)',
          hover:     'rgb(var(--brand-primary-hover) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
        },
        ok:   'rgb(var(--success) / <alpha-value>)',
        'ok-subtle': 'rgb(var(--success-subtle) / <alpha-value>)',
        warn: 'rgb(var(--warning) / <alpha-value>)',
        'warn-subtle': 'rgb(var(--warning-subtle) / <alpha-value>)',
        err:  'rgb(var(--error) / <alpha-value>)',
        'err-subtle': 'rgb(var(--error-subtle) / <alpha-value>)',
        nfo:  'rgb(var(--info) / <alpha-value>)',
        'nfo-subtle': 'rgb(var(--info-subtle) / <alpha-value>)',
        'input-bg':    'rgb(var(--input-bg) / <alpha-value>)',
        'input-brd':   'rgb(var(--input-border) / <alpha-value>)',
        'input-focus': 'rgb(var(--input-focus) / <alpha-value>)',
        'btn-primary': 'rgb(var(--btn-primary) / <alpha-value>)',
        'btn-text':    'rgb(var(--btn-text) / <alpha-value>)',
        'code-bg':   'rgb(var(--code-bg) / <alpha-value>)',
        'code-text': 'rgb(var(--code-text) / <alpha-value>)',
        ring:        'rgb(var(--ring) / <alpha-value>)',

        // ── Legacy fixed color scales (kept so existing raw classes still work) ──
        primary: {
          DEFAULT: '#2563EB',
          light: '#60A5FA',
          dark: '#1D4ED8',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#4F46E5',
          light: '#818CF8',
          dark: '#3730A3',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#EC4899',
          light: '#F472B6',
          dark: '#DB2777',
          foreground: '#FFFFFF',
        },
        neutral: {
          50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
          400: '#94A3B8', DEFAULT: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A',
        },
        info: { DEFAULT: '#38BDF8', foreground: '#0F172A' },
        success: { DEFAULT: '#10B981', light: '#34D399', dark: '#059669', foreground: '#FFFFFF' },
        warning: { DEFAULT: '#FBBF24', foreground: '#0F172A' },
        danger: { DEFAULT: '#F87171', dark: '#EF4444', foreground: '#FFFFFF' },
        dracula: {
          background: '#282a36', currentLine: '#44475a', selection: '#44475a',
          foreground: '#f8f8f2', comment: '#6272a4', cyan: '#8be9fd',
          green: '#50fa7b', orange: '#ffb86c', pink: '#ff79c6',
          purple: '#bd93f9', red: '#ff5555', yellow: '#f1fa8c',
        },
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399', 
          500: '#10B981',
          600: '#059669', 
          700: '#047857',
        },
        slate: { 
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          400: '#94A3B8', 
          500: '#64748B',
          600: '#475569', 
          700: '#334155',
        },
        indigo: { 
          50: '#EEF2FF',
          100: '#E0E7FF',
          600: '#4F46E5', 
        },
        blue: { 
          50: '#EFF6FF',  
          400: '#60A5FA', 
          600: '#2563EB', 
          700: '#1D4ED8', 
        },
        pink: { 
            400: '#F472B6', 
        },
        amber: { 
            400: '#FBBF24', 
        },
        violet: { 
            400: '#A78BFA', 
        },
        green: { 
            400: '#4ADE80', 
        },
        red: { 
            400: '#F87171', 
        },
        sky: { 
            400: '#38BDF8', 
        },
        orange: { 
            400: '#FB923C', 
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" }, // Use string "0" for height
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }, // Use string "0" for height
        },
        "fade-in": {
          '0%': { opacity: '0', transform: 'translateY(-5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        "slide-up": {
          '0%': { opacity: '0', transform: 'translate(-50%, 10px)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        // You might want to add more subtle animations
        "subtle-fade-in": {
          '0%': { opacity: '0' },
          '100%': { opacity: '1'},
        },
        "slide-in-from-bottom": {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards", // ensure it stays at 100%
        "slide-up": "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "subtle-fade-in": "subtle-fade-in 0.5s ease-in-out forwards",
        "slide-in-from-bottom": "slide-in-from-bottom 0.4s ease-out forwards",
      }
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}