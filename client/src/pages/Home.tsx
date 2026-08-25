import { trpc } from "@/lib/trpc";
import { hasLowCollectionSuccessRate, type CollectionReliability } from "@/lib/collectionReliability";
import type { RegionActivity } from "@shared/seismic";
import { AlertTriangle, BellRing, ChartNoAxesCombined, Clock3, LoaderCircle, MapPinned, RefreshCcw, RotateCcw, ShieldCheck, Waves } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { activityLabel, modelStatusCopy } from "./dashboardCopy";

function jstTime(utc: string | null) {
  if (!utc) return "မသိရသေးပါ";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utc));
}

function movementLabel(trend: RegionActivity["trend"]) {
  if (trend === "up") return "ပိုများလာသည်";
  if (trend === "down") return "လျော့လာသည်";
  return "တည်ငြိမ်သည်";
}

function probability(value: number | null) {
  return value === null ? "စစ်ဆေးနေဆဲ" : `${value.toFixed(1)}%`;
}

export default function Home() {
  const snapshot = trpc.seismic.snapshot.useQuery();
  const data = snapshot.data;
  const summary = useMemo(() => {
    if (!data) return null;
    const events24h = data.regions.reduce((total, region) => total + region.events24h, 0);
    const events7d = data.regions.reduce((total, region) => total + region.events7d, 0);
    const magnitudes = data.regions.map(region => region.maxMagnitude7d).filter((value): value is number => value !== null);
    const exampleProbability = data.regions.find(region => region.probabilityM4_24h !== null)?.probabilityM4_24h ?? null;
    const exampleSevenDayProbability = data.regions.find(region => region.probabilityM5_7d !== null)?.probabilityM5_7d ?? null;
    return { events24h, events7d, maxMagnitude7d: magnitudes.length ? Math.max(...magnitudes) : null, exampleProbability, exampleSevenDayProbability };
  }, [data]);
  const reliability = data?.system.collectionReliability as CollectionReliability | null | undefined;
  const hasLowReliability = hasLowCollectionSuccessRate(reliability);
  const wasLowReliability = useRef(false);

  useEffect(() => {
    if (!hasLowReliability) {
      wasLowReliability.current = false;
      return;
    }
    if (wasLowReliability.current) return;
    wasLowReliability.current = true;
    toast.warning("Data collection reliability is below 80%.", { id: "collection-reliability-low-success", description: "The dashboard is showing the source-backed workflow result. Last verified data remains visible." });
  }, [hasLowReliability]);

  if (snapshot.isLoading) return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-6 text-center text-sm font-semibold text-slate-600">Live data ကို စစ်ဆေးနေပါသည်…</main>;
  if (!data || !summary) return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-6 text-center"><div><p className="text-lg font-black text-slate-900">Data ကို ယာယီမဖတ်နိုင်သေးပါ</p><button onClick={() => snapshot.refetch()} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">ပြန်စစ်ရန်</button></div></main>;

  const hasProductionModel = data.model.status === "production";
  const sourceActive = data.collection.status === "active";
  const isRefreshing = snapshot.isFetching && !snapshot.isLoading;

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950 selection:bg-[#c8dded]">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3"><span className="seismic-brand-mark grid h-10 w-10 place-items-center rounded-2xl text-white"><Waves size={19} /></span><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">JAPAN</p><h1 className="text-base font-black tracking-tight">Earthquake Monitor</h1></div></div>
          <div className="flex items-center gap-2"><Link href="/events" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Map</Link><Link href="/alerts" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Alerts</Link><Link href="/forecasts" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Forecasts</Link><Link href="/safety" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Safety</Link><Link href="/status" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Status</Link><button onClick={() => snapshot.refetch()} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950 disabled:cursor-wait disabled:opacity-70" aria-label={isRefreshing ? "Refreshing live data" : "Refresh live data"}>{isRefreshing ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCcw size={14} />}{isRefreshing ? "Refresh…" : "ပြန်စစ်ရန်"}</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="seismic-hero rounded-[28px] px-6 py-7 text-white shadow-[0_18px_55px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="seismic-hero-grid" aria-hidden="true" />
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="relative max-w-2xl"><p className="text-[10px] font-extrabold tracking-[0.18em] text-sky-200">LIVE SEISMIC MONITOR</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Japan earthquake activity ကို စောင့်ကြည့်နေပါသည်</h2><p className="mt-3 text-sm leading-6 text-slate-200">USGS public source မှ အတည်ပြု record များကို အလိုအလျောက် update လုပ်ထားပါသည်။</p></div>
            <div className="relative seismic-live-telemetry"><p className="text-[10px] font-bold tracking-[0.15em] text-sky-200">{isRefreshing ? "REAL-TIME REFRESH" : "DATA STATUS"}</p><p role="status" aria-live="polite" className="mt-1 flex items-center gap-2 text-sm font-bold"><span className={`seismic-live-dot ${isRefreshing ? "seismic-live-dot-refreshing" : sourceActive ? "seismic-live-dot-active" : ""}`} aria-hidden="true" />{isRefreshing ? <LoaderCircle className="animate-spin text-sky-200" size={16} /> : <ShieldCheck size={16} className="text-[#c8dded]" />}{isRefreshing ? "Live source ကို refresh လုပ်နေသည်…" : sourceActive ? "Live data ရရှိနေသည်" : "Update ကို စောင့်နေသည်"}</p></div>
          </div>
          <div className="relative mt-6 flex items-center gap-2 text-xs text-slate-300"><Clock3 size={14} />{isRefreshing ? "Latest verified data ကို ထိန်းထားပြီး source update ကို စစ်ဆေးနေသည်" : `နောက်ဆုံး update: ${jstTime(data.collection.lastSuccess)} (Japan time)`}</div>
        </section>

        {hasLowReliability && reliability && <section role="alert" aria-live="assertive" className="mt-6 rounded-3xl border border-[#f4b183] bg-[#fff5eb] p-4 text-[#8a2c0d] shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#ffe0c2]"><AlertTriangle size={19} /></span><div><p className="text-[10px] font-extrabold tracking-[0.16em]">COLLECTION WARNING</p><h2 className="mt-1 text-lg font-black">Data collection success rate သည် 80% အောက်ရှိနေသည်</h2><p className="mt-1 text-sm leading-6">Recent {reliability.windowRuns} runs အတွင်း {reliability.successRatePercent}% success ရှိပြီး {reliability.failures} failed run နှင့် {reliability.retryAttempts} retry attempts မှတ်တမ်းတင်ထားပါသည်။ နောက်ဆုံးအတည်ပြု data ကို dashboard တွင် ဆက်ပြထားပါသည်။</p></div></div></section>}

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Recent activity summary"><SummaryCard label="လွန်ခဲ့သော 24 နာရီ" value={activityLabel(summary.events24h)} caption="မှတ်တမ်းတင်ထားသော events" /><SummaryCard label="လွန်ခဲ့သော 7 ရက်" value={activityLabel(summary.events7d)} caption="မှတ်တမ်းတင်ထားသော events" /><SummaryCard label="7 ရက်အတွင်း အမြင့်ဆုံး" value={summary.maxMagnitude7d === null ? "မတွေ့ရှိပါ" : `M${summary.maxMagnitude7d.toFixed(1)}`} caption="verified record များမှ" /></section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Monitoring shortcuts"><QuickAction href="/events" icon={<MapPinned size={18} />} eyebrow="EXPLORE" title="Live map" detail="Epicenter နှင့် approximate distance ကိုကြည့်ပါ" /><QuickAction href="/alerts" icon={<BellRing size={18} />} eyebrow="CONTROL" title="Alert center" detail="Sound, quiet hours နှင့် notification ကိုစီမံပါ" /><QuickAction href="/safety" icon={<ShieldCheck size={18} />} eyebrow="PREPARE" title="Safety guide" detail="Official-boundary safety information ကိုကြည့်ပါ" /></section>

        <CollectionReliability reliability={data.system.collectionReliability} />

        <section className="mt-6 rounded-3xl border border-[#b9d2e2] bg-[#edf7fc] p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#c8dded] text-slate-800"><AlertTriangle size={17} /></span><div><h2 className="font-black">ခန့်မှန်းချက် အခြေအနေ</h2><p className="mt-1 text-sm leading-6 text-slate-700">{modelStatusCopy(data.model.status)}</p></div></div>{hasProductionModel && <div className="mt-4 grid gap-3 sm:grid-cols-2"><SimpleProbability label="M4+ · နောက် 24 နာရီ" value={probability(summary.exampleProbability)} /><SimpleProbability label="M5+ · နောက် 7 ရက်" value={probability(summary.exampleSevenDayProbability)} /></div>}</section>

        <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">ဒေသအလိုက်</p><h2 className="mt-1 text-2xl font-black tracking-tight">Japan မှာ ဘယ်နေရာတွေ လှုပ်ရှားနေလဲ</h2></div><p className="text-xs text-slate-500">လွန်ခဲ့သော 7 ရက်</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.regions.map(region => <article key={region.region} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{region.region}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{movementLabel(region.trend)}</span></div><div className="mt-4 flex items-end justify-between"><div><p className="text-2xl font-black">{activityLabel(region.events7d)}</p><p className="text-xs text-slate-500">7 ရက်အတွင်း events</p></div><p className="text-sm font-bold text-slate-700">{region.maxMagnitude7d === null ? "M —" : `အမြင့်ဆုံး M${region.maxMagnitude7d.toFixed(1)}`}</p></div></article>)}</div></section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-5 sm:px-6"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">နောက်ဆုံးမှတ်တမ်း</p><h2 className="mt-1 text-2xl font-black tracking-tight">အခုလတ်တလော earthquakes</h2></div><div className="divide-y divide-slate-100">{data.events.length ? data.events.slice(0, 12).map(event => <article key={event.eventId} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-bold">{event.locality}</p><p className="mt-1 text-xs text-slate-500">{event.region} · {jstTime(event.originTimeUtc)} (Japan time)</p></div><div className="shrink-0 text-right"><p className="text-lg font-black">M{event.magnitude.toFixed(1)}</p><p className="text-[11px] text-slate-500">{event.depthKm === null ? "Depth မသိရ" : `${event.depthKm.toFixed(0)} km depth`}</p></div></article>) : <p className="px-5 py-8 text-sm text-slate-500">အတည်ပြု record မရှိသေးပါ။ နောက်တစ်ကြိမ် update ကို စောင့်နေပါသည်။</p>}</div></section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm leading-6 text-slate-600 sm:px-6"><p className="font-black text-slate-900">သိထားသင့်သည်</p><p className="mt-1">ဤစနစ်သည် USGS public data ကို စောင့်ကြည့်ပြသခြင်းဖြစ်ပြီး တရားဝင်ငလျင်သတိပေးစနစ် မဟုတ်ပါ။ ငလျင်ဖြစ်မည့် အချိန်၊ နေရာ သို့မဟုတ် magnitude ကို အတိအကျ မခန့်မှန်းနိုင်ပါ။ အရေးပေါ်အခြေအနေတွင် Japan ၏ တရားဝင်အာဏာပိုင်များ၏ လမ်းညွှန်ချက်ကို လိုက်နာပါ။</p></section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) { return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-extrabold tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></article>; }
function CollectionReliability({ reliability }: { reliability: CollectionReliability | null }) { return <section aria-labelledby="collection-reliability-title" className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e4f3fb] text-[#14567d]"><ChartNoAxesCombined size={19} /></span><div><p className="text-[10px] font-extrabold tracking-[0.16em] text-slate-500">COLLECTION RELIABILITY</p><h2 id="collection-reliability-title" className="mt-1 text-xl font-black">Data collection အခြေအနေ</h2></div></div>{reliability ? <div className="mt-5 grid gap-3 sm:grid-cols-3"><ReliabilityMetric label="Success rate" value={`${reliability.successRatePercent}%`} detail={`${reliability.successes}/${reliability.windowRuns} recent runs`} /><ReliabilityMetric label="Retry attempts" value={String(reliability.retryAttempts)} detail="recent successful/failed runs" icon={<RotateCcw size={14} />} /><ReliabilityMetric label="Latest run" value={reliability.latestStatus === "success" ? "Success" : "Failed"} detail={`${reliability.failures} failures in window`} /></div> : <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">GitHub Actions run telemetry ကို မရသေးပါ။ ပထမ workflow report ရောက်လာပြီးမှ success rate နှင့် retry count ကို အမှန်အတိုင်းပြပါမည်။</p>}<p className="mt-4 text-xs leading-5 text-slate-500">USGS event data count မဟုတ်ပါ။ Scheduled workflow ၏ source-backed run outcome နှင့် Sheets retry attempts ကိုသာပြသပါသည်။</p></section>; }
function ReliabilityMetric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 flex items-center gap-1.5 text-2xl font-black">{icon}{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>; }
function QuickAction({ href, icon, eyebrow, title, detail }: { href: string; icon: React.ReactNode; eyebrow: string; title: string; detail: string }) { return <Link href={href} className="seismic-quick-action group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="seismic-quick-action-icon">{icon}</span><span className="ml-3 inline-block min-w-0 align-middle"><span className="block text-[10px] font-extrabold tracking-[0.16em] text-slate-500">{eyebrow}</span><span className="mt-1 block text-sm font-black">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span></Link>; }
function SimpleProbability({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#b9d2e2] bg-white px-4 py-3"><p className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
