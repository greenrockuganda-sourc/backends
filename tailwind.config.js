export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        'primary-light': 'var(--primary-light)',
        secondary: 'var(--secondary)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        success: 'var(--success)',
      },
    },
  },
  plugins: [],
}
