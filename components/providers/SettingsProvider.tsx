"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEMES = [
  { id: "charcoal", label: "Charcoal", swatch: "#26282d" },
  { id: "walnut", label: "Walnut", swatch: "#2e231b" },
  { id: "forest", label: "Forest", swatch: "#1d2924" },
  { id: "privacy", label: "Privacy", swatch: "#050506" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
/** How strongly Privacy dims the screen: higher hides more from onlookers. */
export type PrivacyLevel = 1 | 2 | 3;

const THEME_IDS = THEMES.map((theme) => theme.id) as readonly string[];

interface Settings {
  sound: boolean;
  setSound: (value: boolean) => void;
  /** Glow the cards you can afford on your turn. Off by default, toggled by a hidden button. */
  hints: boolean;
  setHints: (value: boolean) => void;
  theme: ThemeId;
  setTheme: (value: ThemeId) => void;
  privacyLevel: PrivacyLevel;
  setPrivacyLevel: (value: PrivacyLevel) => void;
  /** Quick switch: into Privacy, or back to whichever theme was in use before. */
  togglePrivacy: () => void;
  /** Called once saved settings have been read (by HydrateSettings). */
  markLoaded: () => void;
}

/** Mirrors the choice onto <html> so CSS (and the pre-paint script in layout) can use it. */
function applyTheme(theme: ThemeId, level: PrivacyLevel) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.privacy = String(level);
}

function store(key: string, value: boolean | string) {
  try {
    window.localStorage.setItem(key, typeof value === "string" ? value : value ? "on" : "off");
  } catch {
    /* private mode: the choice lasts until reload */
  }
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [sound, setSoundState] = useState(true);
  const [hints, setHintsState] = useState(false);
  // Defaults match the server render; HydrateSettings loads the saved choice.
  const [theme, setThemeState] = useState<ThemeId>("charcoal");
  const [privacyLevel, setPrivacyState] = useState<PrivacyLevel>(2);
  // Until saved settings load, leave <html> as the pre-paint script in layout set
  // it, so Privacy never flashes back to the default theme.
  const [loaded, setLoaded] = useState(false);

  const setSound = useCallback((value: boolean) => {
    setSoundState(value);
    store("gm-sound", value);
  }, []);

  const setHints = useCallback((value: boolean) => {
    setHintsState(value);
    store("gm-hints", value);
  }, []);

  const setTheme = useCallback((value: ThemeId) => {
    setThemeState(value);
    store("gm-theme", value);
  }, []);

  const markLoaded = useCallback(() => setLoaded(true), []);

  const togglePrivacy = useCallback(() => {
    let previous: string | null = null;
    try {
      previous = window.localStorage.getItem("gm-theme-prev");
    } catch {
      /* storage blocked */
    }
    if (theme === "privacy") {
      setTheme(previous && previous !== "privacy" && THEME_IDS.includes(previous) ? (previous as ThemeId) : "charcoal");
    } else {
      store("gm-theme-prev", theme);
      setTheme("privacy");
    }
  }, [theme, setTheme]);

  const setPrivacyLevel = useCallback((value: PrivacyLevel) => {
    setPrivacyState(value);
    store("gm-privacy", String(value));
  }, []);

  useEffect(() => {
    if (loaded) applyTheme(theme, privacyLevel);
  }, [loaded, theme, privacyLevel]);

  const value = useMemo(
    () => ({
      sound,
      setSound,
      hints,
      setHints,
      theme,
      setTheme,
      privacyLevel,
      setPrivacyLevel,
      togglePrivacy,
      markLoaded,
    }),
    [sound, setSound, hints, setHints, theme, setTheme, privacyLevel, setPrivacyLevel, togglePrivacy, markLoaded],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

export function HydrateSettings() {
  const { setSound, setHints, setTheme, setPrivacyLevel, markLoaded } = useSettings();
  useEffect(() => {
    try {
      const sound = window.localStorage.getItem("gm-sound");
      if (sound === "off") setSound(false);
      if (window.localStorage.getItem("gm-hints") === "on") setHints(true);
      const theme = window.localStorage.getItem("gm-theme");
      if (theme && THEME_IDS.includes(theme)) setTheme(theme as ThemeId);
      const level = Number(window.localStorage.getItem("gm-privacy"));
      if (level === 1 || level === 2 || level === 3) setPrivacyLevel(level);
    } catch {
      /* storage blocked: keep defaults */
    }
    markLoaded();
  }, [setSound, setHints, setTheme, setPrivacyLevel, markLoaded]);
  return null;
}
