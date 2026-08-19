/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#0b2018',
          800: '#0f2c21',
          700: '#14382a',
          600: '#1b4534',
        },
        card: {
          face: '#fdfdfb',
          edge: '#d8d5cc',
        },
        accent: {
          DEFAULT: '#e8b84b',
          soft: '#f2d489',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.3), 0 4px 10px rgba(0,0,0,.25)',
        lift: '0 6px 18px rgba(0,0,0,.45)',
      },
    },
  },
  plugins: [],
}
