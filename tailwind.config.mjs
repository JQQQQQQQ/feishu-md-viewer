/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        feishu: {
          'brand-primary': 'var(--feishu-brand-primary)',
          'text-primary': 'var(--feishu-text-primary)',
          'text-secondary': 'var(--feishu-text-secondary)',
          'bg-page': 'var(--feishu-bg-page)',
          'bg-content': 'var(--feishu-bg-content)',
          'border-light': 'var(--feishu-border-light)',
          'code-bg': 'var(--feishu-code-bg)',
          'code-text': 'var(--feishu-code-text)',
          'blockquote-bg': 'var(--feishu-blockquote-bg)',
          'blockquote-border': 'var(--feishu-blockquote-border)',
        },
      },
      fontSize: {
        'feishu-body': 'var(--feishu-font-size-body)',
      },
      lineHeight: {
        feishu: 'var(--feishu-line-height)',
      },
      spacing: {
        'feishu-page': 'var(--feishu-spacing-page)',
      },
      borderRadius: {
        feishu: '8px',
      },
      maxWidth: {
        'feishu-content': '900px',
      },
    },
  },
  plugins: [],
};
