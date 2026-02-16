import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        panel2: 'rgb(var(--panel-2) / <alpha-value>)',
        soft: 'rgb(var(--soft) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        glow: 'rgb(var(--glow) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      boxShadow: {
        soft: '0 6px 26px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(62,197,255,0.28), 0 10px 32px rgba(62,197,255,0.12)'
      },
      borderRadius: {
        xl2: '14px'
      },
      transitionDuration: {
        180: '180ms'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseDot: {
          '0%,100%': { opacity: '0.4' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        rise: 'rise 280ms ease-out',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
