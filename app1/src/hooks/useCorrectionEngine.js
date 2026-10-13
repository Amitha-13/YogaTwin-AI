import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCorrectionPoseName } from "../data/correctionPoseMap";

/**
 * Base URL for the Yoga Pose Correction engine.
 * In dev this defaults to "/correction-api", which the Vite proxy
 * (see app1/vite.config.js) forwards to the engine's "/api" namespace.
 * Override for production with VITE_CORRECTION_API_BASE.
 */
const CORRECTION_API_BASE =
  (import.meta.env && import.meta.env.VITE_CORRECTION_API_BASE) ||
  "/correction-api";

// Throttle: minimum gap between inference requests (~3 req/s).
const MIN_REQUEST_INTERVAL_MS = 330;
// Abort a request if the engine takes longer than this (keeps the loop live).
const REQUEST_TIMEOUT_MS = 2500;
// After N consecutive failures, back off and surface an "engine offline" state.
const MAX_CONSECUTIVE_FAILURES = 3;
// On backoff, pause requests for this long before retrying.
const BACKOFF_MS = 4000;
// Rolling window of recent isMatch results used to smooth status (anti-flicker).
const SMOOTHING_WINDOW = 5;
// Fraction of the window that must be matches to report "Good Form".
const GOOD_FORM_RATIO = 0.6;
// If no fresh landmarks arrive within this long, treat the pose as not detected.
const LANDMARK_STALE_MS = 1200;

/** Possible UI statuses. */
export const CORRECTION_STATUS = {
  IDLE: "idle",
  DETECTING: "detecting", // landmarks seen, awaiting/averaging engine results
  GOOD_FORM: "good_form",
  ADJUST: "adjust",
  NOT_DETECTED: "not_detected", // no/insufficient landmarks
  UNAVAILABLE: "unavailable", // pose not supported by the engine
  ERROR: "error", // engine offline / repeated failures
};

/**
 * Real-time correction loop. Reuses landmarks produced by the EXISTING
 * MediaPipe pipeline (no second detection loop): the caller feeds raw
 * MediaPipe landmarks via the returned `pushLandmarks` callback. The hook
 * throttles and serializes POST /analyze-frame calls to the correction engine
 * and exposes smoothed, actionable results for the practice screen.
 *
 * @param {object} opts
 * @param {boolean} opts.active - whether the correction loop should run
 * @param {string}  opts.appPoseName - current pose name from src/data/poses.js
 * @param {number}  opts.currentStepIndex - current step index (default 0)
 * @param {number|string} [opts.age] - optional user age (age-aware coaching)
 * @param {string} [opts.userName] - optional user name
 */
export function useCorrectionEngine({
  active,
  appPoseName,
  currentStepIndex = 0,
  age,
  userName,
}) {
  const correctionPoseName = useMemo(
    () => getCorrectionPoseName(appPoseName),
    [appPoseName]
  );
  const supported = Boolean(correctionPoseName);

  const [status, setStatus] = useState(CORRECTION_STATUS.IDLE);
  const [matchConfidence, setMatchConfidence] = useState(null); // 0..1 or null
  const [feedback, setFeedback] = useState("");
  const [corrections, setCorrections] = useState([]); // string[]
  const [stepText, setStepText] = useState("");
  const [engineOnline, setEngineOnline] = useState(true);

  // Mutable refs for the hot loop (avoid re-subscribing on every value change).
  const latestLandmarksRef = useRef(null);
  const latestLandmarkTsRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastRequestTsRef = useRef(0);
  const failureCountRef = useRef(0);
  const backoffUntilRef = useRef(0);
  const matchWindowRef = useRef([]);
  const abortRef = useRef(null);
  const paramsRef = useRef({ correctionPoseName, currentStepIndex, age, userName });
  paramsRef.current = { correctionPoseName, currentStepIndex, age, userName };

  /** Caller pushes raw MediaPipe landmarks (array of {x,y,z,visibility}). */
  const pushLandmarks = useCallback((rawLandmarks) => {
    if (Array.isArray(rawLandmarks) && rawLandmarks.length === 33) {
      latestLandmarksRef.current = rawLandmarks;
      latestLandmarkTsRef.current = performance.now();
    }
  }, []);

  const pushStatusFromWindow = useCallback(() => {
    const win = matchWindowRef.current;
    if (win.length === 0) {
      setStatus(CORRECTION_STATUS.DETECTING);
      return;
    }
    const matches = win.filter(Boolean).length;
    const ratio = matches / win.length;
    setStatus(
      ratio >= GOOD_FORM_RATIO
        ? CORRECTION_STATUS.GOOD_FORM
        : CORRECTION_STATUS.ADJUST
    );
  }, []);

  // Reset transient state when pose/step changes or loop toggles.
  useEffect(() => {
    matchWindowRef.current = [];
    failureCountRef.current = 0;
    backoffUntilRef.current = 0;
    setMatchConfidence(null);
    setFeedback("");
    setCorrections([]);
    setStepText("");
  }, [appPoseName, currentStepIndex, active]);

  useEffect(() => {
    if (!active) {
      setStatus(CORRECTION_STATUS.IDLE);
      return undefined;
    }
    if (!supported) {
      setStatus(CORRECTION_STATUS.UNAVAILABLE);
      return undefined;
    }

    let stopped = false;
    let timer = 0;

    const tick = async () => {
      if (stopped) return;

      const now = performance.now();

      // Pause work when the tab is hidden to save battery/CPU.
      if (typeof document !== "undefined" && document.hidden) {
        schedule(300);
        return;
      }

      // Respect backoff window after repeated failures.
      if (now < backoffUntilRef.current) {
        schedule(backoffUntilRef.current - now);
        return;
      }

      // Stale / missing landmarks → not detected (but keep polling).
      const landmarks = latestLandmarksRef.current;
      const landmarkAge = now - latestLandmarkTsRef.current;
      if (!landmarks || landmarkAge > LANDMARK_STALE_MS) {
        setStatus(CORRECTION_STATUS.NOT_DETECTED);
        schedule(200);
        return;
      }

      // Throttle + prevent overlapping requests.
      if (inFlightRef.current || now - lastRequestTsRef.current < MIN_REQUEST_INTERVAL_MS) {
        schedule(60);
        return;
      }

      inFlightRef.current = true;
      lastRequestTsRef.current = now;

      const { correctionPoseName: pose, currentStepIndex: step, age: a, userName: u } =
        paramsRef.current;

      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${CORRECTION_API_BASE}/analyze-frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            poseName: pose,
            currentStepIndex: step,
            landmarks: landmarks.map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z ?? 0,
              visibility: lm.visibility ?? 0,
            })),
            ...(a != null && a !== "" ? { age: a } : {}),
            ...(u ? { userName: u } : {}),
          }),
        });

        if (!res.ok) {
          // 503 (model untrained) or 400 (bad input) — surface, don't crash.
          throw new Error(`engine ${res.status}`);
        }

        const data = await res.json();
        const analysis = data?.analysis || {};

        // Success → reset failure tracking.
        failureCountRef.current = 0;
        setEngineOnline(true);

        // Smooth the match signal across a rolling window to avoid flicker.
        const win = matchWindowRef.current;
        win.push(Boolean(analysis.isMatch));
        if (win.length > SMOOTHING_WINDOW) win.shift();

        setMatchConfidence(
          typeof analysis.matchConfidence === "number"
            ? analysis.matchConfidence
            : null
        );
        setFeedback(analysis.feedback || "");
        setCorrections(
          Array.isArray(analysis.ytCorrections) ? analysis.ytCorrections : []
        );
        if (typeof data.stepText === "string") setStepText(data.stepText);

        pushStatusFromWindow();
      } catch (err) {
        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
          setEngineOnline(false);
          setStatus(CORRECTION_STATUS.ERROR);
          // Clear stale corrections so we never show outdated guidance.
          setFeedback("");
          setCorrections([]);
          setMatchConfidence(null);
          matchWindowRef.current = [];
          backoffUntilRef.current = performance.now() + BACKOFF_MS;
        }
      } finally {
        clearTimeout(timeoutId);
        abortRef.current = null;
        inFlightRef.current = false;
        schedule(40);
      }
    };

    function schedule(delay) {
      if (stopped) return;
      timer = window.setTimeout(tick, Math.max(0, delay));
    }

    schedule(0);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [active, supported, pushStatusFromWindow]);

  return {
    pushLandmarks,
    status,
    supported,
    engineOnline,
    matchConfidence, // 0..1 or null
    feedback,
    corrections,
    stepText,
  };
}
