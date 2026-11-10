/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pastel palette (yellow / lavender / sage / pistachio) + neutrals.
        cream: {
          50: '#FFFCF5',
          100: '#FBF6E7',
          200: '#F4ECCC',
        },
        butter: {
          200: '#FFF1B8',
          300: '#FFE38A',
          400: '#F7CE5B',
          500: '#E8B937',
        },
        lavender: {
          100: '#EFE9FA',
          200: '#DACEF2',
          300: '#C0AEE8',
          400: '#A28BDA',
          500: '#8770C7',
        },
        sage: {
          100: '#EAF1E6',
          200: '#CFE0C5',
          300: '#A9C99A',
          400: '#84B070',
          500: '#5F914A',
        },
        pistachio: {
          100: '#F2F6D9',
          200: '#E1ECA9',
          300: '#C7D873',
          400: '#A8BD4A',
          500: '#86992E',
        },
        ink: {
          DEFAULT: '#2A2A35',
          soft: '#54545F',
          muted: '#8C8C95',
        },
        paper: '#FFFDF8',
        line: '#E6E1D2',
      },
      fontFamily: {
        sans: [
          'Nunito',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        soft: '14px',
      },
      boxShadow: {
        soft: '0 2px 6px -2px rgba(42, 42, 53, 0.08), 0 8px 24px -12px rgba(42, 42, 53, 0.12)',
        ring: '0 0 0 2px rgba(160, 138, 218, 0.4)',
      },
    },
  },
  plugins: [],
}
