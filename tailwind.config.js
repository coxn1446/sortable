/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sortable: {
          primary: {
            start: '#6366F1',
            end: '#3B82F6',
          },
          /** Native launch + static HTML splash plate — sampled from `resources/icon.png` edges (~#504AED). */
          splash: '#504AED',
          bg: '#0F172A',
          surface: '#111827',
          card: '#1F2933',
          /** Visually separates nested ChoiceTiles from card surfaces (hero vs list compare). */
          cardRaised: '#2d3d4d',
          text: {
            primary: '#F9FAFB',
            secondary: '#9CA3AF',
          },
          accent: '#22C55E',
          danger: '#EF4444',
          highlight: '#A78BFA',
          /** OAuth branded buttons (provider guidelines / defaults). */
          oauth: {
            googleBlue: '#4285F4',
            googleGreen: '#34A853',
            googleYellow: '#FBBC05',
            googleRed: '#EA4335',
            googleButtonBg: '#FFFFFF',
            googleButtonBorder: '#747775',
            googleButtonText: '#1F1F1F',
            appleButtonBg: '#000000',
            appleButtonText: '#FFFFFF',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.25)',
        glow: '0 0 20px rgba(99,102,241,0.35)',
      },
      maxHeight: {
        'nav-dropdown': 'min(70dvh, calc(100dvh - 4rem))',
      },
      maxWidth: {
        /** Login / register primary + OAuth buttons (~half of card width). */
        'auth-cta': '50%',
      },
      backgroundImage: {
        'sortable-gradient': 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      scale: {
        102: '1.02',
        105: '1.05',
      },
    },
  },
  plugins: [],
};
