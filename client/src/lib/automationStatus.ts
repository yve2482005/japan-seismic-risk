export type AutomationStatusTone = "healthy" | "active" | "attention" | "pending" | "gated";

export type AutomationStatus = {
  collection: AutomationStatusTone;
  refresh: AutomationStatusTone;
  reliability: AutomationStatusTone;
  alerts: AutomationStatusTone;
  model: AutomationStatusTone;
};

type AutomationInputs = {
  collectionStatus: string;
  freshnessMinutes: number | null;
  reliability: { latestStatus: "success" | "failure"; retryAttempts: number } | null;
  notificationsStatus: string;
  modelStatus: string;
};

/**
 * Derives only UI status tones from verified snapshot fields. It never turns
 * missing telemetry into a healthy state or treats a model candidate as live.
 */
export function getAutomationStatus(input: AutomationInputs): AutomationStatus {
  const collection: AutomationStatusTone = input.collectionStatus === "active" && input.freshnessMinutes !== null && input.freshnessMinutes <= 120
    ? "healthy"
    : input.collectionStatus === "delayed" || input.collectionStatus === "stale"
      ? "attention"
      : "pending";

  const refresh: AutomationStatusTone = input.freshnessMinutes === null
    ? "pending"
    : input.freshnessMinutes <= 120
      ? "active"
      : "attention";

  const reliability: AutomationStatusTone = input.reliability === null
    ? "pending"
    : input.reliability.latestStatus === "failure"
      ? "attention"
      : input.reliability.retryAttempts > 0
        ? "active"
        : "healthy";

  const alerts: AutomationStatusTone = input.notificationsStatus.includes("permission_required")
    ? "pending"
    : "healthy";

  const model: AutomationStatusTone = input.modelStatus === "production" ? "healthy" : "gated";

  return { collection, refresh, reliability, alerts, model };
}

export function automationStatusLabel(status: AutomationStatusTone) {
  switch (status) {
    case "healthy": return "အလိုအလျောက် လည်ပတ်နေသည်";
    case "active": return "အလိုအလျောက် စစ်ဆေးနေသည်";
    case "attention": return "ပြန်စစ်ရန် လိုအပ်သည်";
    case "gated": return "Quality gate ထိန်းထားသည်";
    case "pending": return "အတည်ပြု telemetry စောင့်နေသည်";
  }
}

export function automationStatusToneClass(status: AutomationStatusTone) {
  switch (status) {
    case "healthy": return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "active": return "border-sky-200 bg-sky-50 text-sky-800";
    case "attention": return "border-amber-200 bg-amber-50 text-amber-900";
    case "gated": return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "pending": return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
