/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      sans: ['"Raleway"', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        // Base slate palette
        slate: {
          950: '#080c14',
          900: '#0f1623',
          850: '#141c2e',
          800: '#1a2440',
          700: '#243352',
          600: '#2e4468',
          500: '#4a6fa5',
          400: '#7a9cc6',
          300: '#a8c4de',
          200: '#cbd8e8',
          100: '#e4ecf4',
          50:  '#f2f6fa',
        },
        // Gold accent
        gold: {
          900: '#7a6520',
          800: '#9a7f28',
          700: '#b89a35',
          600: '#c9a84c',
          500: '#d4b76a',
          400: '#dfc888',
          300: '#e8d5a5',
          200: '#f0e4c2',
          100: '#f7f0de',
          50:  '#fbf8f0',
        },
        // Semantic colors
        success: '#34d399',
        danger: '#f87171',
        warning: '#fbbf24',
        info: '#60a5fa',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #0f1623 0%, #141c2e 50%, #0f1623 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
