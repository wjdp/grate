/** @type {import("tailwindcss").Config} */
const colours = require("tailwindcss/colors");

export default {
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
      },
      colors: {
        grey: colours.gray,
      },
    },
  },
  plugins: [],
};
