import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Scenario =
  | "software_engineering"
  | "system_design"
  | "project_manager"
  | "consultant"
  | "cyber_security"
  | "behavioral"
  | "custom";

export type ResponseStyle = "concise" | "detailed" | "balanced";
export type Language = "en" | "es" | "fr" | "de" | "pt" | "zh" | "ja" | "ko" | "ar" | "hi";

export const SCENARIO_META: Record<Scenario, { label: string; description: string }> = {
  software_engineering: {
    label: "Software Engineering",
    description: "Ideal for software engineering interviews and coding challenges.",
  },
  system_design: {
    label: "System Design",
    description: "Perfect for system design discussions and architecture reviews.",
  },
  project_manager: {
    label: "Project Manager",
    description: "Ideal for project management interviews and sprint planning.",
  },
  behavioral: {
    label: "Behavioral",
    description: "Ideal for general, behavioral, and experience-based interviews.",
  },
  consultant: {
    label: "Consultant",
    description: "Suitable for consulting interviews and case study practice.",
  },
  cyber_security: {
    label: "Cyber Security",
    description: "Focused on security concepts, threat modeling, and compliance.",
  },
  custom: {
    label: "Custom",
    description: "Define your own interview scenario and instructions.",
  },
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
};

interface SetupState {
  scenario: Scenario;
  customPrompt: string;
  responseStyle: ResponseStyle;
  language: Language;
  autoSkip: boolean;
  imageAnalysisContext: string;
  speechReflection: boolean;
  selectedResume: string;
  selectedJd: string;
  stealthMode: boolean;

  setScenario: (s: Scenario) => void;
  setCustomPrompt: (p: string) => void;
  setResponseStyle: (s: ResponseStyle) => void;
  setLanguage: (l: Language) => void;
  setAutoSkip: (v: boolean) => void;
  setImageAnalysisContext: (c: string) => void;
  setSpeechReflection: (v: boolean) => void;
  setSelectedResume: (id: string) => void;
  setSelectedJd: (id: string) => void;
  setStealthMode: (v: boolean) => void;
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      scenario: "software_engineering",
      customPrompt: "",
      responseStyle: "concise",
      language: "en",
      autoSkip: true,
      imageAnalysisContext: "",
      speechReflection: false,
      selectedResume: "",
      selectedJd: "",
      stealthMode: false,

      setScenario: (scenario) => set({ scenario }),
      setCustomPrompt: (customPrompt) => set({ customPrompt }),
      setResponseStyle: (responseStyle) => set({ responseStyle }),
      setLanguage: (language) => set({ language }),
      setAutoSkip: (autoSkip) => set({ autoSkip }),
      setImageAnalysisContext: (imageAnalysisContext) => set({ imageAnalysisContext }),
      setSpeechReflection: (speechReflection) => set({ speechReflection }),
      setSelectedResume: (selectedResume) => set({ selectedResume }),
      setSelectedJd: (selectedJd) => set({ selectedJd }),
      setStealthMode: (stealthMode) => set({ stealthMode }),
    }),
    { name: "copilot-setup" },
  ),
);
