import { trpc } from "@/lib/trpc";
import { explorerDataState, filterLiveEvents, magnitudeBins, type EventFilters } from "@/lib/eventExplorer";
import { isWithinJapanMapBounds, mapCoordinate, mapMarkerStyle } from "@/lib/earthquakeMap";
import { JAPAN_REGIONS, type JapanRegion, type SeismicEvent } from "@shared/seismic";
import { ArrowLeft, Crosshair, Info, LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

function localTime(utc: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utc));
}

export default function EventExplorer() {
  const snapshot = trpc.seismic.snapshot.useQuery();
  const [filters, setFilters] = useState<EventFilters>({ period: "7d", minimumMagnitude: 0, region: "All", query: "" });
  const [selected, setSelected] = useState<SeismicEvent | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("Your location is not shown.");
  const dataState = explorerDataState({ isLoading: snapshot.isLoading, isError: snapshot.isError, hasData: Boolean(snapshot.data) });
  const events = useMemo(() => filterLiveEvents(snapshot.data?.events ?? [], filters, new Date()), [snapshot.data?.events, filters]);
  const bins = useMemo(() => magnitudeBins(events), [events]);
  const maxBin = Math.max(...bins.map(bin => bin.count), 1);
  const activeEvent = selected && events.some(event => event.eventId === selected.eventId) ? selected : events[0] ?? null;
  const locationInMap = location ? isWithinJapanMapBounds(location.latitude, location.longitude) : false;

  useEffect(() => {
    if (selected && !events.some(event => event.eventId === selected.eventId)) setSelected(events[0] ?? null);
  }, [events, selected]);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocation(null);
      setLocationStatus("This browser does not support Current Location.");
      return;
    }
    setLocationStatus("Finding your current location…");
    navigator.geolocation.getCurrentPosition(
      position => {
        const nextLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(nextLocation);
        setLocationStatus(isWithinJapanMapBounds(nextLocation.latitude, nextLocation.longitude) ? "Current location is shown on the Japan map for this browser session." : "Your location is outside this Japan-only map view, so no map marker is placed.");
      },
      () => {
        setLocation(null);
        setLocationStatus("Location was not shared. No user marker is shown.");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  if (dataState === "loading") return <ExplorerState title="Live events ကို စစ်ဆေးနေပါသည်…" copy="USGS live dataset ကို ဖတ်နေပါသည်။ အချိန်အနည်းငယ်စောင့်ပါ။" />;
  if (dataState === "error") return <ExplorerState title="Live events ကို ယာယီမဖတ်နိုင်သေးပါ" copy="Data မရရှိချိန်တွင် empty history ကို မပြပါ။ Source connection ကို ပြန်စစ်ရန်အောက်ပါ button ကိုနှိပ်ပါ။" onRetry={() => snapshot.refetch()} />;

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={17} />Live monitor</Link><p className="text-xs font-bold text-slate-500">USGS live events only</p></div></header>
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-400">MAP + HISTORY</p><h1 className="mt-2 text-3xl font-black tracking-tight">Live earthquake map</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">အောက်ပါ marker များသည် USGS live data မှ actual epicenter coordinates ကို ပြထားခြင်းဖြစ်ပါသည်။ Marker အရောင်နှင့်အရွယ်အစားသည် magnitude ကိုပြပြီး၊ map သည် coordinate အခြေပြု approximate Japan view ဖြစ်ပါသည်။</p></section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold">Time range<select value={filters.period} onChange={event => setFilters(current => ({ ...current, period: event.target.value as EventFilters["period"] }))} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label><label className="text-xs font-bold">Minimum magnitude<select value={filters.minimumMagnitude} onChange={event => setFilters(current => ({ ...current, minimumMagnitude: Number(event.target.value) }))} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="0">All magnitudes</option><option value="3">M3+</option><option value="4">M4+</option><option value="5">M5+</option></select></label><label className="text-xs font-bold">Region<select value={filters.region} onChange={event => setFilters(current => ({ ...current, region: event.target.value as JapanRegion | "All" }))} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="All">All Japan</option>{JAPAN_REGIONS.map(region => <option key={region} value={region}>{region}</option>)}</select></label><label className="text-xs font-bold">Search place<div className="relative mt-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={15} /><input value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" placeholder="Place or region" /></div></label></div></section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.42fr_0.58fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">INTERACTIVE MAP</p><h2 className="mt-1 text-xl font-black">{events.length} visible events</h2></div><div className="flex shrink-0 gap-2"><button onClick={requestLocation} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-slate-950"><Crosshair size={14} />Current Location</button>{location && <button onClick={() => { setLocation(null); setLocationStatus("Current location was cleared from this browser session."); }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:border-slate-950">Clear</button>}</div></div><p role="status" className="mt-3 text-xs leading-5 text-slate-500">{locationStatus} Precise location is never sent to the server or saved after this session.</p>
            <div className="relative mt-5 aspect-[1.16/1] overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_70%_30%,#f9fdff_0%,#dceff8_38%,#c5e0ed_100%)]">
              <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#85a9bd_1px,transparent_1px),linear-gradient(90deg,#85a9bd_1px,transparent_1px)] [background-size:20%_20%]" />
              <div className="absolute left-[16%] top-[12%] h-[68%] w-[60%] rotate-[22deg] rounded-[45%_55%_50%_38%] border border-white/80 bg-white/20 shadow-[0_10px_30px_rgba(70,120,148,.12)]" aria-hidden="true" />
              <p className="absolute left-4 top-4 text-[10px] font-extrabold tracking-[0.16em] text-slate-600">APPROXIMATE JAPAN COORDINATE MAP</p><p className="absolute right-4 top-4 rounded-full bg-white/75 px-2 py-1 text-[10px] font-bold text-slate-700">USGS coordinates</p>
              <span className="absolute left-[58%] top-[19%] text-[9px] font-extrabold tracking-wider text-slate-500">HOKKAIDO</span><span className="absolute left-[51%] top-[46%] text-[9px] font-extrabold tracking-wider text-slate-500">HONSHU</span><span className="absolute left-[38%] top-[70%] text-[9px] font-extrabold tracking-wider text-slate-500">KYUSHU</span>
              {events.map(event => { const point = mapCoordinate(event.latitude, event.longitude); const style = mapMarkerStyle(event.magnitude); const selectedMarker = activeEvent?.eventId === event.eventId; return <button key={event.eventId} onClick={() => setSelected(event)} title={`M${event.magnitude.toFixed(1)} · ${event.locality}`} style={{ left: `${point.left}%`, top: `${point.top}%`, width: `${style.size}px`, height: `${style.size}px`, backgroundColor: style.color }} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white text-[9px] font-black text-white shadow-[0_4px_14px_rgba(18,45,61,.42)] transition hover:scale-110 focus-visible:scale-110 ${selectedMarker ? "ring-4 ring-slate-950/30 scale-110" : ""}`} aria-label={`Select M${event.magnitude.toFixed(1)} event at ${event.locality}`}>M{event.magnitude.toFixed(1)}</button>; })}
              {locationInMap && location && (() => { const point = mapCoordinate(location.latitude, location.longitude); return <span style={{ left: `${point.left}%`, top: `${point.top}%` }} className="absolute z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border-2 border-slate-950 bg-white px-1.5 py-1 text-[10px] font-black text-slate-950 shadow" aria-label="Your current browser-session location"><LocateFixed size={12} />You</span>; })()}
              {!events.length && <div className="absolute inset-0 z-20 grid place-items-center bg-white/70 p-6 text-center"><p className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">ဒီ filter အတွက် map ပေါ်တွင် live event မတွေ့ရှိပါ။</p></div>}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap gap-2 rounded-xl bg-white/90 px-3 py-2 text-[10px] font-bold text-slate-700 shadow-sm"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#2782b5]" />Below M5</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#f79009]" />M5+</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#d92d20]" />M6+</span>{locationInMap && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-slate-950 bg-white" />You</span>}</div>
            </div>
          </article>
          <EventDetail event={activeEvent} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">MAGNITUDE DISTRIBUTION</p><h2 className="mt-1 text-xl font-black">Visible event count</h2><div className="mt-5 space-y-3">{bins.map(bin => <div key={bin.label}><div className="mb-1 flex justify-between text-xs font-bold"><span>{bin.label}</span><span>{bin.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#7eb7d8]" style={{ width: `${(bin.count / maxBin) * 100}%` }} /></div></div>)}</div></article><article className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-5"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">SEARCHABLE HISTORY</p><h2 className="mt-1 text-xl font-black">USGS live records</h2></div><div className="divide-y divide-slate-100">{events.length ? events.map(event => <button key={event.eventId} onClick={() => setSelected(event)} className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 ${activeEvent?.eventId === event.eventId ? "bg-[#edf7fc]" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold">{event.locality}</span><span className="mt-1 block text-xs text-slate-500">{event.region} · {localTime(event.originTimeUtc)} JST · {event.depthKm === null ? "Depth unknown" : `${event.depthKm.toFixed(0)} km`}</span></span><span className="shrink-0 text-lg font-black">M{event.magnitude.toFixed(1)}</span></button>) : <p className="px-5 py-9 text-center text-sm text-slate-500">ဒီ filter အတွက် live events မတွေ့ရှိပါ။</p>}</div></article></section>
      </div>
    </main>
  );
}

function EventDetail({ event }: { event: SeismicEvent | null }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">SELECTED EVENT</p>{event ? <div className="mt-3"><div className="flex items-start justify-between gap-3"><div><h2 className="text-3xl font-black">M{event.magnitude.toFixed(1)}</h2><p className="mt-1 font-bold">{event.locality}</p></div><span className="rounded-full bg-[#edf7fc] px-2.5 py-1 text-[10px] font-bold text-slate-700">USGS live</span></div><p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Map marker သည် USGS က ထုတ်ပေးသော epicenter coordinate ကို approximate map ပေါ်တွင်ထားခြင်းဖြစ်သည်။ တရားဝင် emergency warning area မဟုတ်ပါ။</p><dl className="mt-4 divide-y divide-slate-100 text-sm"><Detail label="Region" value={event.region} /><Detail label="Depth" value={event.depthKm === null ? "Unknown" : `${event.depthKm.toFixed(1)} km`} /><Detail label="Time" value={`${localTime(event.originTimeUtc)} JST`} /><Detail label="Source" value="USGS public CSV" /></dl><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-700 underline underline-offset-4"><MapPin size={14} />Open source record</a></div> : <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><Info className="mb-2" size={18} />Marker တစ်ခုကိုနှိပ်ပြီး event details ကိုကြည့်ပါ။ User location သည် optional ဖြစ်ပြီး page ကိုပိတ်လျှင် မသိမ်းထားပါ။</div>}</article>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold">{value}</dd></div>; }

function ExplorerState({ title, copy, onRetry }: { title: string; copy: string; onRetry?: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5 text-center"><div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><Info className="mx-auto text-slate-500" size={24} /><h1 className="mt-4 text-xl font-black">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>{onRetry && <button onClick={onRetry} className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">ပြန်စစ်ရန်</button>}<Link href="/" className="mt-4 block text-sm font-bold text-slate-600 underline underline-offset-4">Live monitor သို့ပြန်သွားရန်</Link></div></main>;
}
