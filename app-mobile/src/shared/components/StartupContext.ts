import { createContext, useContext } from "react";

// Keep navigation mounted, but defer native video creation until branding finishes.
export const StartupReadyContext = createContext(false);
export const useStartupReady = () => useContext(StartupReadyContext);
