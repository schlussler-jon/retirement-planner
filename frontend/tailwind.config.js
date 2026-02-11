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
  // Base slate palette - BRIGHTER text colors
      slate: {
        950: '#080c14',
        900: '#0f1623',
        850: '#141c2e',
        800: '#1a2440',
        700: '#3a4a68',  // Brighter for better contrast
        600: '#4a5f88',  // Brighter for better contrast
        500: '#6a8ab5',  // Brighter for better contrast
        400: '#8fadd0',  // Brighter
        300: '#b5cbea',  // Brighter
        200: '#d0dff0',  // Brighter
        100: '#e8f0f8',  // Brighter
        50:  '#f5f8fc',  // Brighter
      },
  // Gold accent - MUCH BRIGHTER
      gold: {
        900: '#9a7f28',
        800: '#b89a35',
        700: '#d4b054',  // Brighter
        600: '#e5c76f',  // Much brighter - main accent
        500: '#f0d98d',  // Brighter
        400: '#f5e5a8',  // Brighter
        300: '#f8ecc0',  // Brighter
        200: '#fbf3d8',  // Brighter
        100: '#fdf9ec',  // Brighter
        50:  '#fefcf7',  // Brighter
      },
  // Semantic colors - BRIGHTER
  success: '#4ade80',  // Brighter green
  danger: '#fb7185',   // Brighter red
  warning: '#fcd34d',  // Brighter yellow
  info: '#7dd3fc',     // Brighter blue
},        // Semantic colors
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
