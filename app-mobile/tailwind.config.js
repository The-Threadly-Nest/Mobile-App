/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7EF",
        oxblood: "#4A080C",
        gold: "#C4A763",
        ink: "#3A2E1A",
        grey100: "#E4D5B7",
        grey300: "#D9C7A8",
        grey500: "#A6926B",
        grey700: "#8A7550",
      },
      fontFamily: {
        // Headlines / display moments only — see README for usage rules
        display: ["Fraunces-Bold"],
        "display-regular": ["Fraunces-Regular"],
        // Body, buttons, labels, forms, chat — everything small/dense
        body: ["WorkSans_400Regular"],
        "body-medium": ["WorkSans_500Medium"],
        "body-semibold": ["WorkSans_600SemiBold"],
      },
      borderRadius: { none: "0px", pill: "999px" },
    },
  },
  plugins: [],
};
