/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { 400: '#3b82f6', 500: '#2563eb', 600: '#1d4ed8' },
        dark: { 700: '#262626', 800: '#141414', 900: '#0a0a0a', 950: '#050505' }
      }
    },
  },
  plugins: [],
}
