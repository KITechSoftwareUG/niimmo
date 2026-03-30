import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "niimmo-nav-state";
const NAV_CHANGE_EVENT = "niimmo-nav-change";

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
  selectedTab: string | null;
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
  selectedTab: null,
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

// Flag to prevent re-entrant event handling
let isDispatching = false;

export function useNavigationState() {
  const [state, setState] = useState<NavigationState>(loadState);

  // Persist on every change and notify other hook instances
  useEffect(() => {
    saveState(state);
    if (!isDispatching) {
      isDispatching = true;
      window.dispatchEvent(new CustomEvent(NAV_CHANGE_EVENT));
      isDispatching = false;
    }
  }, [state]);

  // Listen for changes from other hook instances
  useEffect(() => {
    const handleNavChange = () => {
      if (!isDispatching) {
        const loaded = loadState();
        setState((prev) => {
          // Only update if actually different (prevent unnecessary re-renders)
          const prevJson = JSON.stringify(prev);
          const loadedJson = JSON.stringify(loaded);
          return prevJson === loadedJson ? prev : loaded;
        });
      }
    };
    window.addEventListener(NAV_CHANGE_EVENT, handleNavChange);
    return () => window.removeEventListener(NAV_CHANGE_EVENT, handleNavChange);
  }, []);

  const update = useCallback((partial: Partial<NavigationState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  return { navState: state, updateNav: update, resetNav: reset };
}
