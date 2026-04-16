import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#f26522',       // Pulse logo orange — buttons, active states, focus rings
          'primary-light': '#f5803e', // Lighter orange — text on dark backgrounds (higher contrast)
          bg: '#110a04',            // Warm dark brown — page background
          surface: '#1e1410',       // Warm dark surface — cards, sidebar, dialogs
        },
      },
    },
  },
  plugins: [],
};

export default config;
