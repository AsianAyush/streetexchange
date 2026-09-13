/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        background: '#0a0a0f',
      },
      animation: {
        'ticker': 'ticker-scroll 30s linear infinite',
        'fade-in-up': 'fade-in-up 0.5s ease forwards',
        'scale-in': 'scale-in 0.3s ease forwards',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
