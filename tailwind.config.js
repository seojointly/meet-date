/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        rankPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)' },
          '50%': { boxShadow: '0 0 0 6px rgba(34, 197, 94, 0)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.25s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out both',
        'rank-pulse': 'rankPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
