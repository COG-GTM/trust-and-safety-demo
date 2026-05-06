/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#0F172A',
        card: '#1E293B',
        cardAlt: '#243449',
        muted: '#94A3B8',
        soft: '#CBD5E1',
        accent: {
          primary: '#22D3EE',
          secondary: '#6366F1',
          success: '#34D399',
          warning: '#FBBF24',
          danger: '#F87171',
          violet: '#A78BFA',
          rose: '#FB7185',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
