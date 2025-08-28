/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A'
        },
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827'
        },
        success: '#10B981',
        danger: '#EF4444'
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        'card': '16px'
      },
      boxShadow: {
        'sm-soft': '0 1px 2px -1px rgba(0,0,0,0.08),0 1px 3px rgba(0,0,0,0.06)',
        'card': '0 2px 8px -2px rgba(0,0,0,0.05), 0 4px 12px -2px rgba(0,0,0,0.04)'
      },
      transitionDuration: {
        250: '250ms'
      }
    }
  },
  plugins: [],
}
