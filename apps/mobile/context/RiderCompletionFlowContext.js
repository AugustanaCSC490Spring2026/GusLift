import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import RatingToast from "../components/RatingToast";
import RideCompletedOverlay from "../components/RideCompletedOverlay";
import {
  COMPLETION_OVERLAY_VISIBLE_MS,
  POST_COMPLETION_REDIRECT_MS,
} from "../lib/completionFlowConstants";
import { runPostCompletionRedirect } from "../lib/completionNavigation";
import {
  dismissRiderRatingToast,
  storeCompletionSnapshot,
} from "../lib/riderCompletionPrompt";
import {
  resolveDriverIdFromRide,
  storeLastCompletedForPrompt,
  wasRatingPromptHandled,
} from "../lib/ratingUtils";

const RiderCompletionFlowContext = createContext(null);

export function RiderCompletionFlowProvider({ children }) {
  const router = useRouter();
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [ratingToast, setRatingToast] = useState(null);
  const [completedRideDetail, setCompletedRideDetail] = useState(null);
  const flowActiveRef = useRef(false);
  const pendingFlowRef = useRef(null);
  const pendingToastRideIdRef = useRef(null);
  const redirectTimerRef = useRef(null);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearRedirectTimer(), [clearRedirectTimer]);

  const clearToastUi = useCallback(() => {
    setRatingToast(null);
    setCompletedRideDetail(null);
  }, []);

  const scheduleDashboardRedirect = useCallback(() => {
    clearRedirectTimer();
    redirectTimerRef.current = setTimeout(() => {
      runPostCompletionRedirect("rider");
      redirectTimerRef.current = null;
    }, POST_COMPLETION_REDIRECT_MS);
  }, [clearRedirectTimer]);

  const startCompletionFlow = useCallback(
    async ({ justCompleted, riderUserId }) => {
      if (!justCompleted?.id || flowActiveRef.current) return false;

      const rideId = String(justCompleted.id);
      if (await wasRatingPromptHandled(rideId)) return false;

      const snapshot = {
        id: justCompleted.id,
        driver: justCompleted.ride?.driver ?? justCompleted.driver,
        driver_id: justCompleted.ride?.driver_id ?? justCompleted.driver_id,
        created_at: justCompleted.ride?.created_at ?? justCompleted.created_at,
      };

      const driverUid = resolveDriverIdFromRide(snapshot);
      if (!driverUid) return false;
      if (String(driverUid).trim() === String(riderUserId).trim()) return false;

      flowActiveRef.current = true;
      pendingToastRideIdRef.current = rideId;

      await storeCompletionSnapshot(snapshot);
      await storeLastCompletedForPrompt(rideId);

      pendingFlowRef.current = {
        riderUserId,
        snapshot,
      };

      setOverlayVisible(true);
      return true;
    },
    [],
  );

  const onOverlayFinished = useCallback(() => {
    setOverlayVisible(false);

    const pending = pendingFlowRef.current;
    if (!pending) {
      flowActiveRef.current = false;
      return;
    }

    const { riderUserId, snapshot } = pending;
    const driverUid = resolveDriverIdFromRide(snapshot);
    if (!driverUid) {
      flowActiveRef.current = false;
      pendingFlowRef.current = null;
      return;
    }

    setCompletedRideDetail({
      rideId: String(snapshot.id),
      driverName: snapshot.driver?.name || "your driver",
      driverId: String(driverUid),
    });
    setRatingToast({
      rideId: String(snapshot.id),
      driverName: snapshot.driver?.name || "your driver",
      fromUserId: String(riderUserId),
      toUserId: String(driverUid),
    });

    scheduleDashboardRedirect();
  }, [scheduleDashboardRedirect]);

  const handleToastDismiss = useCallback(async () => {
    const rideId = ratingToast?.rideId ?? completedRideDetail?.rideId;
    clearRedirectTimer();
    await dismissRiderRatingToast({
      rideId,
      pendingRideIdRef: pendingToastRideIdRef,
      clearToast: () => {
        clearToastUi();
        flowActiveRef.current = false;
        pendingFlowRef.current = null;
      },
    });
  }, [ratingToast, completedRideDetail, clearToastUi, clearRedirectTimer]);

  const value = { startCompletionFlow };

  return (
    <RiderCompletionFlowContext.Provider value={value}>
      {children}
      <RideCompletedOverlay
        visible={overlayVisible}
        onFinished={onOverlayFinished}
        visibleMs={COMPLETION_OVERLAY_VISIBLE_MS}
      />
      <RatingToast
        key={ratingToast?.rideId ?? "rider-rating-toast"}
        visible={ratingToast != null}
        driverName={ratingToast?.driverName}
        rideId={ratingToast?.rideId}
        fromUserId={ratingToast?.fromUserId}
        toUserId={ratingToast?.toUserId}
        onRatedSuccess={() => {
          void handleToastDismiss();
        }}
        onDismiss={() => {
          void handleToastDismiss();
        }}
        onNavigateDetail={() => {
          const detail = completedRideDetail;
          clearRedirectTimer();
          clearToastUi();
          flowActiveRef.current = false;
          router.push({
            pathname: "/rider/RideDetailHistory",
            params: {
              ride_id: detail?.rideId ?? "",
              driver_id: detail?.driverId ?? "",
              driver_name: detail?.driverName ?? "",
            },
          });
        }}
      />
    </RiderCompletionFlowContext.Provider>
  );
}

export function useRiderCompletionFlow() {
  const ctx = useContext(RiderCompletionFlowContext);
  if (!ctx) {
    throw new Error(
      "useRiderCompletionFlow must be used within RiderCompletionFlowProvider",
    );
  }
  return ctx;
}
