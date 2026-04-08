import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6366f1',
          bg: '#0f1117',
          surface: '#1e2130',
        },
      },
    },
  },
  plugins: [],
};

export default config;
