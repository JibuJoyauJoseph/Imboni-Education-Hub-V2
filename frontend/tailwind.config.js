/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#123B5D',        // deep Rwanda blue for primary surfaces and text
        parchment: '#F5FBFD',  // cool page surface
        paper: '#EAF5F8',      // slightly deeper page tone for cards
        gold: '#FAD201',       // Rwanda flag yellow accent
        rule: '#8CC6D9',       // faint sky-blue rule
        sky: '#00A1DE',        // Rwanda flag blue
        leaf: '#20603D',       // Rwanda flag green / approved
        clay: '#B5533C'        // warnings / rejected
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      backgroundImage: {
        'ruled-paper': 'repeating-linear-gradient(to bottom, transparent, transparent 27px, #8FA6C733 28px)'
      }
    }
  },
  plugins: []
};
