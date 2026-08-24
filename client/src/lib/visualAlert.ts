export const VISUAL_ALERT_DURATION_MS = 1_650;

export function visualAlertMessage(magnitude: number) {
  return `အနီရောင် ငလျင်သတိပေးအချက် — M${magnitude.toFixed(1)}`;
}

/** Creates a brief, non-interactive overlay only after an in-app sound is successfully started. */
export function showVisualAlert(magnitude: number): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  document.getElementById("seismic-visual-alert")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "seismic-visual-alert";
  overlay.className = "seismic-visual-alert";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "assertive");
  overlay.textContent = visualAlertMessage(magnitude);
  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), VISUAL_ALERT_DURATION_MS);
  return true;
}
