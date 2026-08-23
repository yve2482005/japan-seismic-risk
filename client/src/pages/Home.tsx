import { RiskMap } from "@/components/RiskMap";
import { trpc } from "@/lib/trpc";
import type { JapanRegion, RiskLevel } from "@shared/seismic";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight, CircleDashed, Database, Gauge, MapPinned, RefreshCcw, ShieldCheck, SlidersHorizontal, Waves } from "lucide-react";
import { useMemo, useState } from "react";

const riskStyle: Record<RiskLevel, string> = {
  LOW: "bg-[#c8dded] text-slate-900",
  MODERATE: "bg-[#f7c7c2] text-slate-900",
  ELEVATED: "bg-[#ef8e85] text-slate-950",
  HIGH: "bg-[#dc5d54] text-white",
};

const navigation = ["Overview", "Regional map", "Events", "Operations"] as const;
type NavItem = typeof navigation[number];

function localTime(utc: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utc));
}

export default function Home() {
  const [active, setActive] = useState<NavItem>("Overview");
  const [selectedRegion, setSelectedRegion] = useState<JapanRegion>("Kyushu");
  const [windowLabel, setWindowLabel] = useState("24H");
  const snapshot = trpc.seismic.snapshot.useQuery();
  const modelReports = trpc.seismic.modelReports.useQuery();
  const data = snapshot.data;
  const storedReport = modelReports.data?.reports.find(report => report.status === "production") ?? modelReports.data?.reports[0];
  const selected = useMemo(() => data?.regions.find(item => item.region === selectedRegion), [data?.regions, selectedRegion]);

  if (snapshot.isLoading || !data || !selected) {
    return <main className="min-h-screen bg-[#f3f6f8] px-6 py-16 text-slate-700">Loading seismic dashboard…</main>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f3f6f8] text-[#111111] selection:bg-[#f7c7c2]">
      <div className="page-accent accent-blue" aria-hidden="true" />
      <div className="page-accent accent-pink" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pb-8 pt-6 sm:px-8 lg:px-10">
        <button className="flex items-center gap-3 text-left" onClick={() => setActive("Overview")} aria-label="Open overview">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#111111] text-white"><Waves size={19} strokeWidth={2.2} /></span>
          <span><span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Japan</span><span className="block text-base font-bold tracking-tight">Seismic monitor</span></span>
        </button>
        <div className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/70 p-1 backdrop-blur md:flex">
          {navigation.map(item => <button key={item} onClick={() => setActive(item)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${active === item ? "bg-[#111111] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{item}</button>)}
        </div>
        <button onClick={() => snapshot.refetch()} className="flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold transition hover:border-slate-900 hover:bg-slate-50" aria-label="Refresh demonstration dashboard"><RefreshCcw size={14} />Refresh</button>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7a5a0]/60 bg-[#fff4f3] px-4 py-3">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7c7c2]"><AlertTriangle size={14} /></span><p className="max-w-4xl text-xs leading-relaxed text-slate-700"><strong className="font-bold text-slate-900">Demonstration mode.</strong> This screen contains synthetic fixtures and no live earthquake feed. It shows how verified, attributed data will be presented after a source passes compliance review. The dashboard estimates probabilities; it cannot reliably predict an earthquake’s exact time, location, or magnitude.</p></div>
          <span className="rounded-full border border-[#e7a5a0] bg-white px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#9f3e37]">DEMO ONLY</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="pb-2">
            <p className="eyebrow">PROBABILISTIC ACTIVITY ESTIMATES</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl">Seismic context,<br /><span className="text-slate-500">without false certainty.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-600">A no-cost operational dashboard for transparent earthquake-data governance, regional activity, and rigorously limited model outputs. It is not an official warning system.</p>
          </div>
          <div className="rounded-[28px] bg-[#111111] p-5 text-white shadow-[0_18px_50px_rgba(17,17,17,0.12)] sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">COLLECTION STATUS</p><p className="mt-2 text-xl font-bold">Safely paused</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><ShieldCheck size={18} /></span></div>
            <p className="mt-3 text-sm leading-5 text-slate-300">A candidate public catalog is listed, but its adapter remains disabled until an operator records a source-specific terms and robots review.</p>
            <button onClick={() => setActive("Operations")} className="mt-5 flex items-center gap-1 text-xs font-bold text-[#c8dded] hover:text-white">Open controls <ChevronRight size={14} /></button>
          </div>
        </div>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Demonstration probability cards">
          {[
            ["M4+ / 24h", selected.probabilityM4_24h, selected.risk],
            ["M5+ / 7d", selected.probabilityM5_7d, selected.risk],
            ["24h events", selected.events24h, "neutral"],
            ["7d maximum", selected.maxMagnitude7d ? `M${selected.maxMagnitude7d.toFixed(1)}` : "—", "neutral"],
          ].map(([label, value, style]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"><p className="text-[10px] font-bold tracking-[0.16em] text-slate-500">{label}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-3xl font-black tracking-[-0.05em]">{typeof value === "number" && String(label).includes("/") ? `${value.toFixed(1)}%` : value}</p>{style !== "neutral" ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${riskStyle[style as RiskLevel]}`}>{style}</span> : <span className="text-xs text-slate-500">demo</span>}</div></article>)}
        </section>
      </section>

      <section className="relative mx-auto mt-12 max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">REGIONAL ACTIVITY</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Japan, region by region</h2></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{["1H", "6H", "24H", "7D", "30D"].map(item => <button key={item} onClick={() => setWindowLabel(item)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold ${windowLabel === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{item}</button>)}</div></div>
            <RiskMap regions={data.regions} selected={selectedRegion} onSelect={setSelectedRegion} />
          </article>

          <article className="panel flex flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">FOCUS REGION</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{selected.region}</h2></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${riskStyle[selected.risk]}`}>{selected.risk}</span></div>
            <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f0f5f8] p-4"><p className="text-[10px] font-bold tracking-[0.15em] text-slate-500">M4+ / NEXT 24H</p><p className="mt-2 text-3xl font-black tracking-[-0.06em]">{selected.probabilityM4_24h.toFixed(1)}%</p></div><div className="rounded-2xl bg-[#fff1ef] p-4"><p className="text-[10px] font-bold tracking-[0.15em] text-slate-500">M5+ / NEXT 7D</p><p className="mt-2 text-3xl font-black tracking-[-0.06em]">{selected.probabilityM5_7d.toFixed(1)}%</p></div></div>
            <dl className="mt-6 divide-y divide-slate-100 text-sm"><div className="flex justify-between py-3"><dt className="text-slate-500">Activity trend</dt><dd className="flex items-center gap-1.5 font-bold capitalize">{selected.trend === "up" ? <ArrowUpRight size={14} className="text-[#c84c43]" /> : <ArrowDownRight size={14} className="text-slate-500" />}{selected.trend}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-500">Events in 7 days</dt><dd className="font-bold">{selected.events7d}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-500">Mean depth</dt><dd className="font-bold">{selected.meanDepthKm ?? "—"} km</dd></div></dl>
            <p className="mt-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">This is a model-display example. A probability is a quantified estimate under a defined target; it is not certainty that an earthquake will or will not occur.</p>
          </article>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <article className="panel overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:p-6"><div><p className="eyebrow">VALIDATED EVENT QUEUE</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Recent event structure</h2></div><span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><CircleDashed size={13} /> Demo fixtures</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left"><thead><tr className="border-y border-slate-100 bg-slate-50 text-[10px] font-bold tracking-[0.13em] text-slate-500"><th className="px-6 py-3">EVENT</th><th className="px-4 py-3">MAG.</th><th className="px-4 py-3">DEPTH</th><th className="px-4 py-3">JST</th><th className="px-6 py-3">PROVENANCE</th></tr></thead><tbody>{data.events.map(event => <tr key={event.eventId} className="border-b border-slate-100 text-sm last:border-0"><td className="px-6 py-4"><p className="font-bold">{event.locality}</p><p className="mt-0.5 text-xs text-slate-500">{event.region} · {event.latitude.toFixed(1)}°, {event.longitude.toFixed(1)}°</p></td><td className="px-4 py-4 font-black">M{event.magnitude.toFixed(1)}</td><td className="px-4 py-4 text-slate-600">{event.depthKm ?? "—"} km</td><td className="px-4 py-4 text-slate-600">{localTime(event.originTimeUtc)}</td><td className="px-6 py-4"><span className="rounded-full bg-[#fff1ef] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9f3e37]">{event.provenance}</span></td></tr>)}</tbody></table></div>
          </article>

          <article className="panel p-5 sm:p-6">
            <p className="eyebrow">MODEL TRANSPARENCY</p><div className="mt-2 flex items-start justify-between gap-3"><h2 className="text-2xl font-black tracking-[-0.04em]">Metrics before claims</h2><Gauge size={21} className="text-slate-500" /></div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{storedReport ? `Registry report ${storedReport.modelVersion} · ${storedReport.status}. Metrics were produced by the chronological evaluation pipeline.` : `The ${data.model.version} model card is a display-only fixture. No verified historical dataset has been loaded, so it has no reportable accuracy, precision, recall, or calibration.`}</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><Metric label="Accuracy" value={storedReport?.accuracy === null || storedReport?.accuracy === undefined ? "Pending" : `${(storedReport.accuracy * 100).toFixed(1)}%`} /><Metric label="PR-AUC" value={storedReport?.prAuc === null || storedReport?.prAuc === undefined ? "Pending" : storedReport.prAuc.toFixed(3)} /><Metric label="Recall" value={storedReport?.recall === null || storedReport?.recall === undefined ? "Pending" : storedReport.recall.toFixed(3)} /><Metric label="Brier score" value={storedReport?.brierScore === null || storedReport?.brierScore === undefined ? "Pending" : storedReport.brierScore.toFixed(3)} /></div>
            <div className="mt-5 rounded-xl bg-[#111111] p-4 text-white"><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">98% BENCHMARK</p><p className="mt-1 text-sm font-bold">{storedReport ? "Actual registry result shown above." : "Not assessed — never forced."}</p><p className="mt-1 text-xs leading-5 text-slate-300">A future candidate can be promoted only after leakage-safe, chronological evaluation, calibration review, and configured quality gates.</p></div>
          </article>
        </div>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <OperationalCard icon={<Database size={18} />} label="Source registry" value="1 candidate" copy="Disabled pending documented compliance review." action="Review source" onClick={() => setActive("Operations")} />
          <OperationalCard icon={<BarChart3 size={18} />} label="Training workflow" value="Not scheduled" copy="No automatic retraining runs until validated records are available." action="View model policy" onClick={() => setActive("Operations")} />
          <OperationalCard icon={<SlidersHorizontal size={18} />} label="Data export" value="Sheets ready" copy="Required tabs and headers are defined; authorization has not been requested." action="View structure" onClick={() => setActive("Operations")} />
        </section>

        {active === "Operations" && <section className="mt-6 rounded-[28px] border border-[#111111] bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><Activity className="mt-0.5" size={20} /><div><p className="eyebrow">NO-COST OPERATIONS MODE</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Everything is visible; nothing is silently enabled.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">The data schema, parser, validation, deduplication, coordinate classification, Google Sheets structure, and model registry are present in the codebase. Live collection remains off until a source owner records its allowed access method and a Google authorization is intentionally supplied. This protects source terms, prevents untraceable data, and keeps the initial implementation free of added services.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Status label="Source compliance" value="Pending review" /><Status label="Live records" value="0" /><Status label="Scheduled runs" value="0" /></div></section>}
      </section>
      <footer className="border-t border-slate-200 bg-white/60 px-5 py-7 text-xs leading-5 text-slate-600 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4"><p>Japan Seismic Monitor · Demonstration mode · Source attribution is mandatory for all future records.</p><p>Probabilistic estimates are not official warnings and do not replace guidance from authorities.</p></div></footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 px-3 py-3"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function Status({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold tracking-[0.13em] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function OperationalCard({ icon, label, value, copy, action, onClick }: { icon: React.ReactNode; label: string; value: string; copy: string; action: string; onClick: () => void }) { return <article className="panel p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ecf2f5]">{icon}</div><p className="mt-4 text-[10px] font-bold tracking-[0.14em] text-slate-500">{label}</p><h3 className="mt-1 text-lg font-black tracking-[-0.03em]">{value}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p><button onClick={onClick} className="mt-4 text-xs font-bold underline decoration-slate-300 underline-offset-4 hover:decoration-black">{action}</button></article>; }
