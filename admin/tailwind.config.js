/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebedff',
          200: '#dde0ff',
          300: '#c5cbff',
          400: '#a3adff',
          500: '#7985ff',
          600: '#4f59ff',
          700: '#3c43e0',
          800: '#3237b8',
          900: '#2d3094',
          950: '#1b1c57',
        }
      }
    },
  },
  plugins: [],
}
