import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import RideCompletedOverlay from "../components/RideCompletedOverlay";
import {
  COMPLETION_OVERLAY_VISIBLE_MS,
  POST_COMPLETION_REDIRECT_MS,
} from "../lib/completionFlowConstants";
import { runPostCompletionRedirect } from "../lib/completionNavigation";

const DriverCompletionFlowContext = createContext(null);

export function DriverCompletionFlowProvider({ children }) {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const flowActiveRef = useRef(false);
  const redirectTimerRef = useRef(null);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearRedirectTimer(), [clearRedirectTimer]);

  const scheduleDashboardRedirect = useCallback(() => {
    clearRedirectTimer();
    redirectTimerRef.current = setTimeout(() => {
      runPostCompletionRedirect("driver");
      redirectTimerRef.current = null;
    }, POST_COMPLETION_REDIRECT_MS);
  }, [clearRedirectTimer]);

  const startDriverCompletionFlow = useCallback(() => {
    if (flowActiveRef.current) return false;
    flowActiveRef.current = true;
    setOverlayVisible(true);
    return true;
  }, []);

  const onOverlayFinished = useCallback(() => {
    setOverlayVisible(false);
    scheduleDashboardRedirect();
    flowActiveRef.current = false;
  }, [scheduleDashboardRedirect]);

  const finishFlow = useCallback(() => {
    clearRedirectTimer();
    flowActiveRef.current = false;
  }, [clearRedirectTimer]);

  const value = { startDriverCompletionFlow, finishFlow };

  return (
    <DriverCompletionFlowContext.Provider value={value}>
      {children}
      <RideCompletedOverlay
        visible={overlayVisible}
        onFinished={onOverlayFinished}
        visibleMs={COMPLETION_OVERLAY_VISIBLE_MS}
      />
    </DriverCompletionFlowContext.Provider>
  );
}

export function useDriverCompletionFlow() {
  const ctx = useContext(DriverCompletionFlowContext);
  if (!ctx) {
    throw new Error(
      "useDriverCompletionFlow must be used within DriverCompletionFlowProvider",
    );
  }
  return ctx;
}
