import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { loadState, saveState } from "../utils/storage.js";
import { toISODate } from "../utils/dates.js";
import { API_URL } from "../utils/api.js";

const StoreContext = createContext(null);

function initialState() {
  const saved = loadState();
  if (saved) return saved;

  return {
    branches: [],
    activeBranchId: null,
    publicHolidaysByYear: {},
    lastUpdatedISO: toISODate(new Date()),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_BRANCHES": {
      const branches = action.payload || [];
      return {
        ...state,
        branches,
        activeBranchId:
          state.activeBranchId && branches.some((b) => b.id === state.activeBranchId)
            ? state.activeBranchId
            : branches[0]?.id ?? null,
      };
    }

    case "SET_ACTIVE_BRANCH":
      return {
        ...state,
        activeBranchId: action.payload,
      };

    case "SET_PUBLIC_HOLIDAYS": {
      const { year, holidays } = action;
      return {
        ...state,
        publicHolidaysByYear: {
          ...state.publicHolidaysByYear,
          [year]: holidays,
        },
        lastUpdatedISO: toISODate(new Date()),
      };
    }

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, initialState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const loadBranches = useCallback(async () => {
    try {
      if (!API_URL) throw new Error("VITE_API_URL is not set");

      const res = await fetch(`${API_URL}/branches`);
      if (!res.ok) throw new Error(`Failed to fetch branches (${res.status})`);

      const data = await res.json();
      dispatch({ type: "SET_BRANCHES", payload: data });
      return { ok: true, data };
    } catch (e) {
      console.error("loadBranches error:", e);
      return { ok: false, message: e?.message || "Failed to load branches" };
    }
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, loadBranches }),
    [state, loadBranches]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
