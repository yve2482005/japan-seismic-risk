import { trpc } from "@/lib/trpc";
import type { RegionActivity } from "@shared/seismic";
import { AlertTriangle, Clock3, RefreshCcw, ShieldCheck, Waves } from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";
import { activityLabel, modelStatusCopy } from "./dashboardCopy";

function jstTime(utc: string | null) {
  if (!utc) return "မသိရသေးပါ";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utc));
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
    return {
      events24h,
      events7d,
      maxMagnitude7d: magnitudes.length ? Math.max(...magnitudes) : null,
      exampleProbability,
      exampleSevenDayProbability,
    };
  }, [data]);

  if (snapshot.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-6 text-center text-sm font-semibold text-slate-600">Live data ကို စစ်ဆေးနေပါသည်…</main>;
  }

  if (!data || !summary) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-6 text-center"><div><p className="text-lg font-black text-slate-900">Data ကို ယာယီမဖတ်နိုင်သေးပါ</p><button onClick={() => snapshot.refetch()} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">ပြန်စစ်ရန်</button></div></main>;
  }

  const hasProductionModel = data.model.status === "production";

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950 selection:bg-[#c8dded]">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white"><Waves size={19} /></span>
            <div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">JAPAN</p><h1 className="text-base font-black tracking-tight">Earthquake Monitor</h1></div>
          </div>
          <div className="flex items-center gap-2"><Link href="/events" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Map</Link><Link href="/alerts" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Alerts</Link><Link href="/forecasts" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Forecasts</Link><Link href="/safety" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Safety</Link><Link href="/status" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950">Status</Link><button onClick={() => snapshot.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:border-slate-950" aria-label="Refresh live data"><RefreshCcw size={14} />ပြန်စစ်ရန်</button></div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="rounded-[28px] bg-slate-950 px-6 py-7 text-white shadow-[0_18px_55px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-400">လက်ရှိအခြေအနေ</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Japan earthquake activity ကို စောင့်ကြည့်နေပါသည်</h2><p className="mt-3 text-sm leading-6 text-slate-300">USGS public source မှ အတည်ပြု record များကို အလိုအလျောက် update လုပ်ထားပါသည်။</p></div>
            <div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold tracking-[0.15em] text-slate-400">DATA STATUS</p><p className="mt-1 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-[#c8dded]" />{data.collection.status === "active" ? "Live data ရရှိနေသည်" : "Update ကို စောင့်နေသည်"}</p></div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400"><Clock3 size={14} />နောက်ဆုံး update: {jstTime(data.collection.lastSuccess)} (Japan time)</div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Recent activity summary">
          <SummaryCard label="လွန်ခဲ့သော 24 နာရီ" value={activityLabel(summary.events24h)} caption="မှတ်တမ်းတင်ထားသော events" />
          <SummaryCard label="လွန်ခဲ့သော 7 ရက်" value={activityLabel(summary.events7d)} caption="မှတ်တမ်းတင်ထားသော events" />
          <SummaryCard label="7 ရက်အတွင်း အမြင့်ဆုံး" value={summary.maxMagnitude7d === null ? "မတွေ့ရှိပါ" : `M${summary.maxMagnitude7d.toFixed(1)}`} caption="verified record များမှ" />
        </section>

        <section className="mt-6 rounded-3xl border border-[#b9d2e2] bg-[#edf7fc] p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#c8dded] text-slate-800"><AlertTriangle size={17} /></span><div><h2 className="font-black">ခန့်မှန်းချက် အခြေအနေ</h2><p className="mt-1 text-sm leading-6 text-slate-700">{modelStatusCopy(data.model.status)}</p></div></div>
          {hasProductionModel && <div className="mt-4 grid gap-3 sm:grid-cols-2"><SimpleProbability label="M4+ · နောက် 24 နာရီ" value={probability(summary.exampleProbability)} /><SimpleProbability label="M5+ · နောက် 7 ရက်" value={probability(summary.exampleSevenDayProbability)} /></div>}
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">ဒေသအလိုက်</p><h2 className="mt-1 text-2xl font-black tracking-tight">Japan မှာ ဘယ်နေရာတွေ လှုပ်ရှားနေလဲ</h2></div><p className="text-xs text-slate-500">လွန်ခဲ့သော 7 ရက်</p></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.regions.map(region => <article key={region.region} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{region.region}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{movementLabel(region.trend)}</span></div><div className="mt-4 flex items-end justify-between"><div><p className="text-2xl font-black">{activityLabel(region.events7d)}</p><p className="text-xs text-slate-500">7 ရက်အတွင်း events</p></div><p className="text-sm font-bold text-slate-700">{region.maxMagnitude7d === null ? "M —" : `အမြင့်ဆုံး M${region.maxMagnitude7d.toFixed(1)}`}</p></div></article>)}</div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">နောက်ဆုံးမှတ်တမ်း</p><h2 className="mt-1 text-2xl font-black tracking-tight">အခုလတ်တလော earthquakes</h2></div>
          <div className="divide-y divide-slate-100">{data.events.length ? data.events.slice(0, 12).map(event => <article key={event.eventId} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-bold">{event.locality}</p><p className="mt-1 text-xs text-slate-500">{event.region} · {jstTime(event.originTimeUtc)} (Japan time)</p></div><div className="shrink-0 text-right"><p className="text-lg font-black">M{event.magnitude.toFixed(1)}</p><p className="text-[11px] text-slate-500">{event.depthKm === null ? "Depth မသိရ" : `${event.depthKm.toFixed(0)} km depth`}</p></div></article>) : <p className="px-5 py-8 text-sm text-slate-500">အတည်ပြု record မရှိသေးပါ။ နောက်တစ်ကြိမ် update ကို စောင့်နေပါသည်။</p>}</div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-5 py-5 text-sm leading-6 text-slate-600 sm:px-6"><p className="font-black text-slate-900">သိထားသင့်သည်</p><p className="mt-1">ဤစနစ်သည် USGS public data ကို စောင့်ကြည့်ပြသခြင်းဖြစ်ပြီး တရားဝင်ငလျင်သတိပေးစနစ် မဟုတ်ပါ။ ငလျင်ဖြစ်မည့် အချိန်၊ နေရာ သို့မဟုတ် magnitude ကို အတိအကျ မခန့်မှန်းနိုင်ပါ။ အရေးပေါ်အခြေအနေတွင် Japan ၏ တရားဝင်အာဏာပိုင်များ၏ လမ်းညွှန်ချက်ကို လိုက်နာပါ။</p></section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-extrabold tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></article>;
}

function SimpleProbability({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#b9d2e2] bg-white px-4 py-3"><p className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}
