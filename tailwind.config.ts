import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        night: '#0A0A0F',
        plum: '#5B2C83',
      },
    },
  },
  plugins: [],
} satisfies Config;
