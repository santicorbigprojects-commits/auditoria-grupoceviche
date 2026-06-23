import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        naranja:   '#EE5128',
        terranova: '#D5372A',
        navy:      '#121621',
        crema:     '#FEF5E4',
        ambar:     '#FF9445',
        marron:    '#4E1015',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
