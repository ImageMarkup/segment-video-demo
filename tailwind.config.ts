import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

export default {
  content: [
    './src/**/*.html',
  ],
  plugins: [
    daisyui,
  ],
  daisyui: {
    logs: false,
  },
} satisfies Config;
