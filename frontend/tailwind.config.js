/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable (see src/index.css) so the whole app can be re-themed in one place.
// The "<alpha-value>" placeholder is what makes classes like bg-primary/10 work.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Variable', 'IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
        report: ['Fraunces', 'Georgia', 'serif']
      },
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        pos: token('pos'),
        neg: token('neg'),
        warn: token('warn')
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 6px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: []
};
