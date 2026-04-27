/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        parchment: 'var(--parchment)',
        'off-white': 'var(--white)',
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          strong: 'var(--rule-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          deep: 'var(--primary-deep)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          soft: 'var(--secondary-soft)',
        },
        success: {
          soft: 'var(--success-soft)',
          deep: 'var(--success-deep)',
        },
        danger: {
          soft: 'var(--danger-soft)',
          deep: 'var(--danger-deep)',
        },
        bulb: 'var(--bulb)',
        warning: {
          deep: 'var(--warning-deep)',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        card: 'var(--r-card)',
        btn: 'var(--r-btn)',
        chip: 'var(--r-chip)',
      },
    },
  },
  plugins: [],
};
