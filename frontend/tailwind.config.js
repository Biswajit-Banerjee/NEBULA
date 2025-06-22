/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
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
        primary: {
          DEFAULT: '#2563EB', // blue-600
          light: '#60A5FA',   // blue-400
          dark: '#1D4ED8',    // blue-700
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#4F46E5', // indigo-600
          light: '#818CF8',   // indigo-400
          dark: '#3730A3',    // indigo-700
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#EC4899', // pink-500
          light: '#F472B6',   // pink-400
          dark: '#DB2777',    // pink-600
          foreground: '#FFFFFF',
        },
        neutral: {
          50: '#F8FAFC',    // slate-50
          100: '#F1F5F9',   // slate-100
          200: '#E2E8F0',   // slate-200
          300: '#CBD5E1',   // slate-300
          400: '#94A3B8',   // slate-400
          DEFAULT: '#64748B', // slate-500
          600: '#475569',   // slate-600
          700: '#334155',   // slate-700
          800: '#1E293B',   // slate-800
          900: '#0F172A',   // slate-900
        },
        info: {
          DEFAULT: '#38BDF8', // sky-400
          foreground: '#0F172A', // dark text for light info bg
        },
        success: {
          DEFAULT: '#10B981', // emerald-500
          light: '#34D399',   // emerald-400
          dark: '#059669',    // emerald-600
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#FBBF24', // amber-400
          foreground: '#0F172A', // dark text for light warning bg
        },
        danger: {
          DEFAULT: '#F87171', // red-400
          dark: '#EF4444',    // red-500
          foreground: '#FFFFFF',
        },
        // Keeping your original custom shades if they are used directly elsewhere,
        // but ideally, you'd map them to the semantic colors above.
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399', // Added from SearchPanel
          500: '#10B981',
          600: '#059669', // Added from SearchPanel for hover
          700: '#047857',
        },
        slate: { // Merged with neutral, but keeping for reference if needed
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          400: '#94A3B8', // Added from SearchPanel
          500: '#64748B',
          600: '#475569', // Added from SearchPanel
          700: '#334155',
        },
        indigo: { // Merged with secondary, but keeping for reference
          50: '#EEF2FF',
          100: '#E0E7FF',
          600: '#4F46E5', // Added from App.jsx for title gradient
        },
        blue: { // Merged with primary, but keeping for reference
          50: '#EFF6FF',  // Added from App.jsx gradient
          400: '#60A5FA', // Added from SearchPanel
          600: '#2563EB', // Added from App.jsx title gradient & SearchPanel
          700: '#1D4ED8', // Added from SearchPanel hover
        },
        pink: { // Merged with accent
            400: '#F472B6', // from SearchPanel
        },
        amber: { // Merged with warning
            400: '#FBBF24', // from SearchPanel
        },
        violet: { // Could be another accent or a new semantic color if used often
            400: '#A78BFA', // from SearchPanel
        },
        green: { // Could be another shade of success or a new semantic color
            400: '#4ADE80', // from SearchPanel
        },
        red: { // Merged with danger
            400: '#F87171', // from SearchPanel
        },
        sky: { // Merged with info
            400: '#38BDF8', // from SearchPanel
        },
        orange: { // Could be another shade of warning or a new semantic color
            400: '#FB923C', // from SearchPanel
        },
        dracula: {
          background: '#282a36',
          currentLine: '#44475a',
          selection: '#44475a',
          foreground: '#f8f8f2',
          comment: '#6272a4',
          cyan: '#8be9fd',
          green: '#50fa7b',
          orange: '#ffb86c',
          pink: '#ff79c6',
          purple: '#bd93f9',
          red: '#ff5555',
          yellow: '#f1fa8c',
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
  plugins: [require("tailwindcss-animate")],
}