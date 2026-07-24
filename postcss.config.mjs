/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 ships its PostCSS integration as a separate package.
    // There is no tailwind.config.ts — tokens live in src/app/globals.css (@theme).
    // See docs/adr/0008-tailwind-v4-css-first-theming.md
    '@tailwindcss/postcss': {},
  },
};

export default config;
