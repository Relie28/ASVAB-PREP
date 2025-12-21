import tailwindPlugin from '@tailwindcss/postcss';

// Ensure we export the actual plugin function/object rather than a plain string which
// can cause PostCSS to treat it as invalid when resolving in some environments.
const plugins = [];
if (tailwindPlugin) plugins.push((tailwindPlugin && (tailwindPlugin.default || tailwindPlugin)));

const config = { plugins };

export default config;
