import { trpc } from "@/lib/trpc";
import { approximateDistanceKm } from "@/lib/geo";
import { magnitudeSoundLabel, playMagnitudeSound } from "@/lib/notificationSounds";
import { getBrowserPushSubscription, removeBrowserPushSubscription } from "@/lib/webPush";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { JAPAN_REGIONS, type JapanRegion } from "@shared/seismic";
import { ArrowLeft, Bell, BellRing, CheckCircle2, LocateFixed, MapPin, Settings2, Volume2, Vibrate } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

type Preferences = { minimumMagnitude: 4 | 5 | 6; regions: JapanRegion[]; sound: boolean; vibration: boolean; notifications: boolean };
type SessionLocation = { latitude: number; longitude: number } | null;
const KEY = "japan-seismic-alert-preferences-v1";
const defaults: Preferences = { minimumMagnitude: 4, regions: [...JAPAN_REGIONS], sound: true, vibration: true, notifications: false };

function readPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<Preferences>;
    return { minimumMagnitude: parsed.minimumMagnitude === 5 || parsed.minimumMagnitude === 6 ? parsed.minimumMagnitude : 4, regions: Array.isArray(parsed.regions) ? parsed.regions.filter((region): region is JapanRegion => JAPAN_REGIONS.includes(region as JapanRegion)) : defaults.regions, sound: Boolean(parsed.sound), vibration: Boolean(parsed.vibration), notifications: Boolean(parsed.notifications) };
  } catch { return defaults; }
}

function localTime(utc: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utc));
}

export default function Alerts() {
  const snapshot = trpc.seismic.snapshot.useQuery();
  const { isAuthenticated } = useAuth();
  const pushConfig = trpc.push.configuration.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const pushStatus = trpc.push.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const subscribePush = trpc.push.subscribe.useMutation({ onSuccess: () => { void pushStatus.refetch(); } });
  const unsubscribePush = trpc.push.unsubscribe.useMutation({ onSuccess: () => { void pushStatus.refetch(); } });
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [location, setLocation] = useState<SessionLocation>(null);
  const [locationMessage, setLocationMessage] = useState("Location is not enabled.");
  const [soundMessage, setSoundMessage] = useState("Choose a magnitude tier to test its in-app sound.");
  const seededAlertIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    setPreferences(readPreferences());
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(preferences)); }, [preferences]);

  useEffect(() => {
    const incoming = snapshot.data?.alerts ?? [];
    if (seededAlertIds.current === null) { seededAlertIds.current = new Set(incoming.map(alert => alert.alertId)); return; }
    const fresh = incoming.filter(alert => !seededAlertIds.current!.has(alert.alertId));
    incoming.forEach(alert => seededAlertIds.current!.add(alert.alertId));
    if (!preferences.sound || !fresh.length) return;
    const strongest = Math.max(...fresh.map(alert => alert.eventMagnitude));
    if (!playMagnitudeSound(strongest)) setSoundMessage("This browser cannot play an in-app sound. You can still view the alert history.");
  }, [preferences.sound, snapshot.data?.alerts]);

  const alerts = useMemo(() => (snapshot.data?.alerts ?? []).filter(alert => alert.eventMagnitude >= preferences.minimumMagnitude && preferences.regions.includes(alert.region)), [snapshot.data?.alerts, preferences]);
  const update = (partial: Partial<Preferences>) => setPreferences(current => ({ ...current, ...partial }));
  const enableBackgroundPush = async () => {
    if (!isAuthenticated) return startLogin();
    if (!pushConfig.data?.publicKey) return setSoundMessage("Preparing secure background notifications. Please try again shortly.");
    try {
      const subscription = await getBrowserPushSubscription(pushConfig.data.publicKey);
      await subscribePush.mutateAsync({ subscription, preferences: { minimumMagnitude: preferences.minimumMagnitude, regions: preferences.regions } });
      setPermission("granted");
      setSoundMessage("Background notification is enabled for this device. New matching USGS alerts can arrive while the app is closed.");
    } catch (error) { setSoundMessage(error instanceof Error ? error.message : "Unable to enable background notifications."); }
  };
  const disableBackgroundPush = async () => {
    try {
      const endpoint = await removeBrowserPushSubscription();
      if (endpoint) await unsubscribePush.mutateAsync({ endpoint });
      setSoundMessage("Background notification has been turned off on this device.");
    } catch { setSoundMessage("Unable to turn off this device’s background notification."); }
  };
  const requestLocation = () => {
    if (!("geolocation" in navigator)) return setLocationMessage("This browser does not support location access.");
    setLocationMessage("Requesting permission…");
    navigator.geolocation.getCurrentPosition(
      position => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationMessage("Location is being used only in this page to show approximate distance."); },
      () => { setLocation(null); setLocationMessage("Location was not shared. Distance will not be shown."); },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };
  const toggleRegion = (region: JapanRegion) => update({ regions: preferences.regions.includes(region) ? preferences.regions.filter(value => value !== region) : [...preferences.regions, region] });
  const testSound = (magnitude: number) => setSoundMessage(playMagnitudeSound(magnitude) ? `${magnitudeSoundLabel(magnitude)} preview played.` : "This browser cannot play an in-app sound. Check device/browser sound settings.");

  return <main className="min-h-screen bg-[#f5f7f8] text-slate-950"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-4 sm:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={17} />Live monitor</Link><p className="text-xs font-bold text-slate-500">Earthquake detection alerts</p></div></header><div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-10">
    <section className="rounded-3xl bg-slate-950 p-6 text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-400">ALERTS</p><h1 className="mt-2 text-3xl font-black tracking-tight">ငလျင်တွေ့ရှိမှု အသိပေးချက်</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">ဤစာရင်းသည် USGS live source မှ threshold ပြည့်သော event များသာဖြစ်ပြီး prediction သို့မဟုတ် တရားဝင်သတိပေးချက် မဟုတ်ပါ။</p></div><BellRing className="shrink-0 text-[#c8dded]" size={28} /></div></section>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Settings2 size={18} /><h2 className="font-black">သင့် alert settings</h2></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Minimum magnitude<select value={preferences.minimumMagnitude} onChange={event => update({ minimumMagnitude: Number(event.target.value) as 4 | 5 | 6 })} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value={4}>M4.0+</option><option value={5}>M5.0+</option><option value={6}>M6.0+</option></select></label><div><p className="text-sm font-bold">Background notification</p><button onClick={enableBackgroundPush} disabled={subscribePush.isPending} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"><Bell size={15} />{isAuthenticated ? (pushStatus.data?.enabled ? "Update this device" : "Enable when app is closed") : "Sign in to enable"}</button>{pushStatus.data?.enabled && <button onClick={disableBackgroundPush} className="mt-2 ml-2 inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">Turn off</button>}<p className="mt-2 text-xs leading-5 text-slate-500">Matching USGS alert အသစ်များကို app ပိတ်ထားချိန်တွင် ပို့နိုင်ရန် account နှင့်ဤ device ကိုသာချိတ်ပါသည်။ Silent/DND ကို ကျော်လွှားမပေးနိုင်ပါ။ iPhone/iPad တွင် Home Screen app အဖြစ် install လုပ်ထားရနိုင်ပါသည်။</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><Toggle label="Sound (supported when app is open)" icon={<Volume2 size={15} />} checked={preferences.sound} onChange={value => update({ sound: value })} /><Toggle label="Vibration (device support only)" icon={<Vibrate size={15} />} checked={preferences.vibration} onChange={value => update({ vibration: value })} /></div><div className="mt-5 rounded-2xl border border-[#b8d9eb] bg-[#edf7fc] p-4"><p className="flex items-center gap-2 text-sm font-black"><Volume2 size={16} />Magnitude sound preview</p><p className="mt-1 text-xs leading-5 text-slate-600">App ဖွင့်ထားချိန်တွင်သာ in-app sound ရနိုင်ပါသည်။ Test button ကိုနှိပ်၍ အသံကွဲပြားမှု စမ်းပါ—အသံသည် official warning level မဟုတ်ပါ။</p><div className="mt-3 flex flex-wrap gap-2">{[4, 6].map(magnitude => <button key={magnitude} onClick={() => testSound(magnitude)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-slate-950">Test {magnitudeSoundLabel(magnitude)}</button>)}</div><p role="status" className="mt-2 text-xs font-medium text-slate-600">{soundMessage}</p></div><div className="mt-5"><p className="text-sm font-bold">Monitor regions</p><div className="mt-2 flex flex-wrap gap-2">{JAPAN_REGIONS.map(region => <button key={region} onClick={() => toggleRegion(region)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${preferences.regions.includes(region) ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{region}</button>)}</div></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-bold"><LocateFixed size={16} />Optional distance from you</p><p className="mt-1 text-xs leading-5 text-slate-600">Your precise location is used only in this page for approximate straight-line distance and is never stored or sent to the server.</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={requestLocation} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-slate-950">Use my location</button>{location && <button onClick={() => { setLocation(null); setLocationMessage("Location cleared from this page."); }} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 underline">Clear location</button>}</div><p className="mt-2 text-xs text-slate-500">{locationMessage}</p></div></section>
    <section className="mt-6"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">HISTORY</p><h2 className="mt-1 text-2xl font-black">Alert history</h2></div><p className="text-sm font-bold text-slate-500">{alerts.length} alerts</p></div><div className="mt-4 space-y-3">{alerts.length ? alerts.map(alert => <article key={alert.alertId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold tracking-[0.15em] text-slate-500">{alert.severity.toUpperCase()} DETECTION</p><h3 className="mt-1 text-xl font-black">M{alert.eventMagnitude.toFixed(1)} · {alert.locality}</h3><p className="mt-1 text-sm text-slate-600"><MapPin className="mr-1 inline" size={14} />{alert.region} · {alert.depthKm === null ? "Depth unknown" : `${alert.depthKm.toFixed(0)} km depth`} · {localTime(alert.originTimeUtc)} (Japan time)</p>{location && alert.latitude !== null && alert.longitude !== null && <p className="mt-2 text-xs font-bold text-slate-700">Distance from you: approximately {approximateDistanceKm(location, { latitude: alert.latitude, longitude: alert.longitude })} km</p>}</div><span className="rounded-full bg-[#edf7fc] px-2.5 py-1 text-[10px] font-bold text-slate-700">USGS live</span></div><p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{alert.reason}</p></article>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><CheckCircle2 className="mx-auto text-slate-400" size={24} /><p className="mt-3 font-black">လက်ရှိ settings အတွက် alert မရှိသေးပါ</p><p className="mt-1 text-sm text-slate-500">Alert history သည် လာမည့် USGS live collection များတွင် threshold ပြည့်သော event အသစ်များအတွက် စတင်ပေါ်လာပါမည်။</p></div>}</div></section>
  </div></main>;
}

function Toggle({ label, icon, checked, onChange }: { label: string; icon: React.ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return <button onClick={() => onChange(!checked)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-bold ${checked ? "border-[#9ac9e3] bg-[#edf7fc]" : "border-slate-200 bg-white"}`}><span className="flex items-center gap-2">{icon}{label}</span><span>{checked ? "On" : "Off"}</span></button>;
}
