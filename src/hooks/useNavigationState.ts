import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "niimmo-nav-state";

interface NavigationState {
  selectedImmobilie: string | null;
  selectedEinheit: string | null;
  selectedMietvertrag: string | null;
  showAnalytics: boolean;
  showControlboard: boolean;
  showUebergabe: boolean;
  showDarlehen: boolean;
  showDevBoard: boolean;
  navigationSource: "dashboard" | "immobilie" | "search";
}

const defaultState: NavigationState = {
  selectedImmobilie: null,
  selectedEinheit: null,
  selectedMietvertrag: null,
  showAnalytics: false,
  showControlboard: false,
  showUebergabe: false,
  showDarlehen: false,
  showDevBoard: false,
  navigationSource: "dashboard",
};

function loadState(): NavigationState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaultState, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

function saveState(state: NavigationState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useNavigationState() {
  const [state, setState] = useState<NavigationState>(loadState);

  // Persist on every change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const update = useCallback((partial: Partial<NavigationState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  return { navState: state, updateNav: update, resetNav: reset };
}
