/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7EF",
        oxblood: "#453332",
        gold: "#C4A763",
        ink: "#3A2E1A",
        grey100: "#E4D5B7",
        grey300: "#D9C7A8",
        grey500: "#A6926B",
        grey700: "#8A7550",
      },
      fontFamily: {
        // Headlines / display moments only — see README for usage rules
        display: ["HedvigLettersSerif-Regular"],
        "display-regular": ["HedvigLettersSerif-Regular"],
        // Body, buttons, labels, forms, chat — everything small/dense
        body: ["InstrumentSans-Regular"],
        "body-medium": ["InstrumentSans-Medium"],
        "body-semibold": ["InstrumentSans-SemiBold"],
        "body-bold": ["InstrumentSans-Bold"],
      },
      borderRadius: { none: "0px", pill: "999px" },
    },
  },
  plugins: [],
};
