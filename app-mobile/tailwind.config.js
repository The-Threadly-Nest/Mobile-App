/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        charcoal: "#2B2B2B",
        tomato: "#F96951",
        mocha: "#453332",
        white: "#FFFDF9",
        // Legacy utility aliases stay compatible, using only the brand palette.
        cream: "#F9E8D3",
        oxblood: "#453332",
        gold: "#453332",
        ink: "#453332",
        grey100: "#FFFDF9",
        grey300: "#FFFDF9",
        grey500: "#453332",
        grey700: "#453332",
      },
      // Soften text-black without changing black backgrounds, borders or shadows.
      textColor: { black: "#4A403B", charcoal: "#4A403B" },
      fontFamily: {
        // Preserve existing utility names while using one font family everywhere.
        display: ["InstrumentSans-Regular"],
        "display-regular": ["InstrumentSans-Regular"],
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
