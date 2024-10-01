/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      width: {
        75: '18.75rem', //300px
        22.5: '5.625rem', //90px
      },
      height: {
        100: '25rem' /* 400px */,
        22.5: '5.625rem', //90px
      },
      borderRadius: {
        '1/2': '50%',
      }
    },
  },
  plugins: [],
}

