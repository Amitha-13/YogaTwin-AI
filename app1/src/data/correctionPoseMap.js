/**
 * Maps the app's pose names (src/data/poses.js) to the exact pose names the
 * Yoga Pose Correction engine was trained on (its GET /api/poses `name` field,
 * which is Sanskrit-qualified, e.g. "Tadasana (Mountain Pose)").
 *
 * Only poses the engine actually supports are listed. Poses with no trained
 * equivalent (e.g. "Wind-Relieving Pose" / Pavanamukthasana) are intentionally
 * absent — getCorrectionPoseName() returns null for those so the UI can show a
 * clear "correction unavailable for this pose" state instead of guessing.
 *
 * Verified against the engine's labels.json (74 step classes across 13 poses).
 */
export const APP_TO_CORRECTION_POSE = {
  "Mountain Pose": "Tadasana (Mountain Pose)",
  "Tree Pose": "Vrkasana (Tree Pose)",
  "Hand-to-Foot Pose": "Pada-hastasana (Hand-to-Foot Pose)",
  "Half Wheel Pose": "Ardha Cakrasana (Half-Wheel Pose)",
  "Triangle Pose": "Trikonasana (Triangle Pose)",
  "Half Camel Pose": "Ardha Ustrasana (Half Camel Pose)",
  "Twisted Pose": "Vakrasana (Twisted Pose)",
  "Corpse Pose": "Savasana (Corpse Pose)",
  // "Wind-Relieving Pose" (Pavanamukthasana): no trained equivalent → unsupported.
};

/**
 * @param {string} appPoseName - a pose `name` from src/data/poses.js
 * @returns {string|null} the engine pose name, or null if unsupported
 */
export function getCorrectionPoseName(appPoseName) {
  return APP_TO_CORRECTION_POSE[appPoseName] ?? null;
}
