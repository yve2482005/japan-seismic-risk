import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { startLogin } from "@/const";
import { approximateDistanceKm } from "@/lib/geo";
import { isForegroundAlertThreshold, shouldPlayForegroundSound, shouldTriggerForegroundAlert, testAlertMode, type ForegroundAlertThreshold } from "@/lib/foregroundAlerts";
import { isEventWithinNearbyRadius, isNearbyRadiusKm, type NearbyRadiusKm } from "@/lib/nearbyAlerts";
import { DEFAULT_MAGNITUDE_SOUND_OPTIONS, isHighMagnitudeSoundOption, isMidMagnitudeSoundOption, magnitudeSoundLabel, playMagnitudeSound, soundOptionLabel, type HighMagnitudeSoundOption, type MidMagnitudeSoundOption } from "@/lib/notificationSounds";
import { DEFAULT_QUIET_HOURS, foregroundSoundIsMuted, isQuietHoursActive, isTimeInput } from "@/lib/quietHours";
import { trpc } from "@/lib/trpc";
import { showVisualAlert } from "@/lib/visualAlert";
import { getBrowserPushSubscription, removeBrowserPushSubscription } from "@/lib/webPush";
import { JAPAN_REGIONS, type JapanRegion } from "@shared/seismic";
import { ArrowLeft, Bell, BellRing, CheckCircle2, LocateFixed, MapPin, Moon, Settings2, Sun, Volume2, Vibrate } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

type Preferences = {
  minimumMagnitude: ForegroundAlertThreshold;
  foregroundMinimumMagnitude: ForegroundAlertThreshold;
  nearbyOnly: boolean;
  nearbyRadiusKm: NearbyRadiusKm;
  visualOnly: boolean;
  midMagnitudeSound: MidMagnitudeSoundOption;
  highMagnitudeSound: HighMagnitudeSoundOption;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  regions: JapanRegion[];
  sound: boolean;
  vibration: boolean;
  notifications: boolean;
};

type SessionLocation = { latitude: number; longitude: number } | null;

const KEY = "japan-seismic-alert-preferences-v1";
const defaults: Preferences = {
  minimumMagnitude: 4,
  foregroundMinimumMagnitude: 4,
  nearbyOnly: false,
  nearbyRadiusKm: 250,
  visualOnly: false,
  midMagnitudeSound: DEFAULT_MAGNITUDE_SOUND_OPTIONS.midMagnitude,
  highMagnitudeSound: DEFAULT_MAGNITUDE_SOUND_OPTIONS.highMagnitude,
  quietHoursEnabled: DEFAULT_QUIET_HOURS.enabled,
  quietHoursStart: DEFAULT_QUIET_HOURS.start,
  quietHoursEnd: DEFAULT_QUIET_HOURS.end,
  regions: [...JAPAN_REGIONS],
  sound: true,
  vibration: true,
  notifications: false,
};

function readPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<Preferences>;
    return {
      minimumMagnitude: isForegroundAlertThreshold(parsed.minimumMagnitude) ? parsed.minimumMagnitude : 4,
      foregroundMinimumMagnitude: isForegroundAlertThreshold(parsed.foregroundMinimumMagnitude) ? parsed.foregroundMinimumMagnitude : 4,
      nearbyOnly: Boolean(parsed.nearbyOnly),
      nearbyRadiusKm: isNearbyRadiusKm(parsed.nearbyRadiusKm) ? parsed.nearbyRadiusKm : 250,
      visualOnly: Boolean(parsed.visualOnly),
      midMagnitudeSound: isMidMagnitudeSoundOption(parsed.midMagnitudeSound) ? parsed.midMagnitudeSound : defaults.midMagnitudeSound,
      highMagnitudeSound: isHighMagnitudeSoundOption(parsed.highMagnitudeSound) ? parsed.highMagnitudeSound : defaults.highMagnitudeSound,
      quietHoursEnabled: Boolean(parsed.quietHoursEnabled),
      quietHoursStart: isTimeInput(parsed.quietHoursStart) ? parsed.quietHoursStart : defaults.quietHoursStart,
      quietHoursEnd: isTimeInput(parsed.quietHoursEnd) ? parsed.quietHoursEnd : defaults.quietHoursEnd,
      regions: Array.isArray(parsed.regions)
        ? parsed.regions.filter((region): region is JapanRegion => JAPAN_REGIONS.includes(region as JapanRegion))
        : defaults.regions,
      sound: Boolean(parsed.sound),
      vibration: Boolean(parsed.vibration),
      notifications: Boolean(parsed.notifications),
    };
  } catch {
    return defaults;
  }
}

function localTime(utc: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utc));
}

export default function Alerts() {
  const snapshot = trpc.seismic.snapshot.useQuery();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pushConfig = trpc.push.configuration.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const pushStatus = trpc.push.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const subscribePush = trpc.push.subscribe.useMutation({ onSuccess: () => { void pushStatus.refetch(); } });
  const unsubscribePush = trpc.push.unsubscribe.useMutation({ onSuccess: () => { void pushStatus.refetch(); } });
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [location, setLocation] = useState<SessionLocation>(null);
  const [locationMessage, setLocationMessage] = useState("Location is not enabled.");
  const [soundMessage, setSoundMessage] = useState("Choose a magnitude tier to test its in-app sound and visual alert.");
  const seededAlertIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    setPreferences(readPreferences());
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    const incoming = snapshot.data?.alerts ?? [];
    if (seededAlertIds.current === null) {
      seededAlertIds.current = new Set(incoming.map(alert => alert.alertId));
      return;
    }
    const fresh = incoming.filter(alert => !seededAlertIds.current!.has(alert.alertId));
    incoming.forEach(alert => seededAlertIds.current!.add(alert.alertId));
    const thresholdEligible = fresh.filter(alert => shouldTriggerForegroundAlert(true, preferences.foregroundMinimumMagnitude, alert.eventMagnitude));
    if (preferences.nearbyOnly && !location) {
      if (thresholdEligible.length) setSoundMessage("Nearby location filter is on. Use your location before receiving local foreground alerts.");
      return;
    }
    const visible = preferences.nearbyOnly
      ? thresholdEligible.filter(alert => isEventWithinNearbyRadius(location, alert, preferences.nearbyRadiusKm))
      : thresholdEligible;
    if (!visible.length) return;
    const strongest = Math.max(...visible.map(alert => alert.eventMagnitude));
    const quietHours = { enabled: preferences.quietHoursEnabled, start: preferences.quietHoursStart, end: preferences.quietHoursEnd };
    if (foregroundSoundIsMuted(preferences.visualOnly, quietHours)) {
      showVisualAlert(strongest);
      setSoundMessage(preferences.visualOnly ? "Visual-only alert shown. Sound is muted for this device." : "Quiet hours active: visual alert shown and sound is muted for this device.");
    } else if (shouldPlayForegroundSound(preferences.sound, preferences.visualOnly)) {
      if (playMagnitudeSound(strongest, { midMagnitude: preferences.midMagnitudeSound, highMagnitude: preferences.highMagnitudeSound })) showVisualAlert(strongest);
      else setSoundMessage("This browser cannot play an in-app sound. You can still view the alert history.");
    }
  }, [location, preferences.foregroundMinimumMagnitude, preferences.highMagnitudeSound, preferences.midMagnitudeSound, preferences.nearbyOnly, preferences.nearbyRadiusKm, preferences.quietHoursEnabled, preferences.quietHoursEnd, preferences.quietHoursStart, preferences.sound, preferences.visualOnly, snapshot.data?.alerts]);

  const alerts = useMemo(
    () => (snapshot.data?.alerts ?? []).filter(alert => alert.eventMagnitude >= preferences.minimumMagnitude && preferences.regions.includes(alert.region)),
    [snapshot.data?.alerts, preferences.minimumMagnitude, preferences.regions],
  );

  const update = (partial: Partial<Preferences>) => setPreferences(current => ({ ...current, ...partial }));
  const magnitudeSoundOptions = { midMagnitude: preferences.midMagnitudeSound, highMagnitude: preferences.highMagnitudeSound };
  const quietHours = { enabled: preferences.quietHoursEnabled, start: preferences.quietHoursStart, end: preferences.quietHoursEnd };

  const enableBackgroundPush = async () => {
    if (!isAuthenticated) return startLogin();
    if (!pushConfig.data?.publicKey) {
      setSoundMessage("Preparing secure background notifications. Please try again shortly.");
      return;
    }
    try {
      const subscription = await getBrowserPushSubscription(pushConfig.data.publicKey);
      await subscribePush.mutateAsync({
        subscription,
        preferences: { minimumMagnitude: preferences.minimumMagnitude, regions: preferences.regions },
      });
      setSoundMessage("Background notification is enabled for this device. New matching USGS alerts can arrive while the app is closed.");
    } catch (error) {
      setSoundMessage(error instanceof Error ? error.message : "Unable to enable background notifications.");
    }
  };

  const disableBackgroundPush = async () => {
    try {
      const endpoint = await removeBrowserPushSubscription();
      if (endpoint) await unsubscribePush.mutateAsync({ endpoint });
      setSoundMessage("Background notification has been turned off on this device.");
    } catch {
      setSoundMessage("Unable to turn off this device’s background notification.");
    }
  };

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationMessage("This browser does not support location access.");
      return;
    }
    setLocationMessage("Requesting permission…");
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("Location is being used only in this page to show approximate distance.");
      },
      () => {
        setLocation(null);
        setLocationMessage("Location was not shared. Distance will not be shown.");
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  const toggleRegion = (region: JapanRegion) => {
    update({ regions: preferences.regions.includes(region) ? preferences.regions.filter(value => value !== region) : [...preferences.regions, region] });
  };

  const testSound = (magnitude: number) => {
    if (foregroundSoundIsMuted(preferences.visualOnly, quietHours)) {
      showVisualAlert(magnitude);
      setSoundMessage(preferences.visualOnly ? "Visual-only preview shown. Sound is muted for this device." : "Quiet hours active: visual-only preview shown. Sound is muted for this device.");
      return;
    }
    const played = playMagnitudeSound(magnitude, magnitudeSoundOptions);
    if (played) showVisualAlert(magnitude);
    setSoundMessage(
      played
        ? `${magnitudeSoundLabel(magnitude, magnitudeSoundOptions)} preview played with a red visual alert.`
        : "This browser cannot play an in-app sound. Check device/browser sound settings.",
    );
  };

  const testSiren = () => {
    if (foregroundSoundIsMuted(preferences.visualOnly, quietHours)) {
      showVisualAlert(6);
      setSoundMessage(preferences.visualOnly ? "Visual-only preview shown. Sound is muted for this device." : "Quiet hours active: M6.0+ visual preview shown. Sound is muted for this device.");
      return;
    }
    const played = playMagnitudeSound(6, magnitudeSoundOptions);
    setSoundMessage(
      played
        ? `Test Siren: ${soundOptionLabel(preferences.highMagnitudeSound)} preview is playing. This is only a sound test; no alert or notification was created.`
        : "Test Siren could not start sound in this browser. Check browser or device audio settings.",
    );
  };

  const runTestAlert = () => {
    const magnitude = preferences.foregroundMinimumMagnitude;
    const mode = testAlertMode(preferences.sound, preferences.visualOnly);
    if (mode === "visual_only" || isQuietHoursActive(quietHours)) {
      showVisualAlert(magnitude);
      setSoundMessage(mode === "visual_only" ? `Test Alert: visual-only mode is working at M${magnitude}. No sound was played.` : `Test Alert: quiet hours active at M${magnitude}. Visual alert shown; no sound was played.`);
      return;
    }
    if (mode === "sound_and_visual") {
      if (playMagnitudeSound(magnitude, magnitudeSoundOptions)) {
        showVisualAlert(magnitude);
        setSoundMessage(`Test Alert: sound and red visual alert are working at M${magnitude}.`);
      } else {
        setSoundMessage("Test Alert could not start sound in this browser. Check browser or device audio settings.");
      }
      return;
    }
    setSoundMessage("Test Alert: foreground sound is off. Turn on Sound or Mute sound — visual alert only to test an alert.");
  };

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={17} />Live monitor</Link>
          <p className="text-xs font-bold text-slate-500">Earthquake detection alerts</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="rounded-3xl bg-slate-950 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-400">ALERTS</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">ငလျင်တွေ့ရှိမှု အသိပေးချက်</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">ဤစာရင်းသည် USGS live source မှ threshold ပြည့်သော event များသာဖြစ်ပြီး prediction သို့မဟုတ် တရားဝင်သတိပေးချက် မဟုတ်ပါ။</p>
            </div>
            <BellRing className="shrink-0 text-[#c8dded]" size={28} />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Settings2 size={18} /><h2 className="font-black">သင့် alert settings</h2></div>
          <div className="mt-4"><Toggle label="Dark mode (night-friendly)" icon={theme === "dark" ? <Moon size={15} /> : <Sun size={15} />} checked={theme === "dark"} onChange={() => toggleTheme?.()} /></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Alert history & background minimum magnitude
              <select value={preferences.minimumMagnitude} onChange={event => update({ minimumMagnitude: Number(event.target.value) as ForegroundAlertThreshold })} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value={4}>M4.0+</option><option value={5}>M5.0+</option><option value={6}>M6.0+</option>
              </select>
            </label>
            <div>
              <p className="text-sm font-bold">Background notification</p>
              <button onClick={enableBackgroundPush} disabled={subscribePush.isPending} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                <Bell size={15} />{isAuthenticated ? (pushStatus.data?.enabled ? "Update this device" : "Enable when app is closed") : "Sign in to enable"}
              </button>
              {pushStatus.data?.enabled && <button onClick={disableBackgroundPush} className="mt-2 ml-2 inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">Turn off</button>}
              <p className="mt-2 text-xs leading-5 text-slate-500">Matching USGS alert အသစ်များကို app ပိတ်ထားချိန်တွင် ပို့နိုင်ရန် account နှင့်ဤ device ကိုသာချိတ်ပါသည်။ Silent/DND ကို ကျော်လွှားမပေးနိုင်ပါ။ iPhone/iPad တွင် Home Screen app အဖြစ် install လုပ်ထားရနိုင်ပါသည်။</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#f0b5ae] bg-[#fff4f3] p-4">
            <label className="block text-sm font-black">Sound & red visual alert starts at
              <select value={preferences.foregroundMinimumMagnitude} onChange={event => update({ foregroundMinimumMagnitude: Number(event.target.value) as ForegroundAlertThreshold })} className="mt-2 block w-full rounded-xl border border-[#e7aaa3] bg-white px-3 py-2 text-sm font-bold">
                <option value={4}>M4.0+</option><option value={5}>M5.0+</option><option value={6}>M6.0+</option>
              </select>
            </label>
            <p className="mt-2 text-xs leading-5 text-slate-600">App ဖွင့်ထားချိန်တွင် အသံနှင့် အနီရောင် visual effect စတင်မည့် level ကိုသာ သီးခြားရွေးပါသည်။ Alert history နှင့် background notification setting ကို မပြောင်းလဲပါ။</p>
          </div>

          <div className="mt-5 rounded-2xl border border-[#bdd5c6] bg-[#f2fbf5] p-4">
            <Toggle label="Nearby location only" icon={<LocateFixed size={15} />} checked={preferences.nearbyOnly} onChange={nearbyOnly => update({ nearbyOnly })} />
            {preferences.nearbyOnly && <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Nearby radius
                <select value={preferences.nearbyRadiusKm} onChange={event => update({ nearbyRadiusKm: Number(event.target.value) as NearbyRadiusKm })} className="mt-2 block w-full rounded-xl border border-[#a8ccb4] bg-white px-3 py-2 text-sm">
                  <option value={100}>Within 100 km</option><option value={250}>Within 250 km</option><option value={500}>Within 500 km</option>
                </select>
              </label>
              <div><p className="text-sm font-bold">Your current location</p><button onClick={requestLocation} className="mt-2 rounded-xl border border-[#a8ccb4] bg-white px-3 py-2 text-sm font-bold hover:border-slate-950">{location ? "Refresh location" : "Use my location"}</button></div>
            </div>}
            <p className="mt-3 text-xs leading-5 text-slate-600">Nearby-only is for app-open sound and red visual alerts. Your precise location stays only in this browser session and is not sent to the server. App-closed background notifications continue to use your selected region filter.</p>
            {preferences.nearbyOnly && <p className="mt-2 text-xs font-bold text-slate-700">{location ? `Nearby filter active: within ${preferences.nearbyRadiusKm} km.` : "Choose “Use my location” to activate the nearby filter."}</p>}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Toggle label="Sound (supported when app is open)" icon={<Volume2 size={15} />} checked={preferences.sound} onChange={sound => update({ sound })} />
            <Toggle label="Mute sound — visual alert only" icon={<BellRing size={15} />} checked={preferences.visualOnly} onChange={visualOnly => update({ visualOnly })} />
            <Toggle label="Vibration (device support only)" icon={<Vibrate size={15} />} checked={preferences.vibration} onChange={vibration => update({ vibration })} />
          </div>

          <div className="mt-5 rounded-2xl border border-[#b8d9eb] bg-[#edf7fc] p-4">
            <p className="flex items-center gap-2 text-sm font-black"><Volume2 size={16} />Magnitude sound options</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">App ဖွင့်ထားချိန်တွင် magnitude အလိုက်အသုံးပြုမည့် in-app sound ကိုရွေးပါ။ ဤအသံများသည် official warning level မဟုတ်ပါ။</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">M4.0–M5.9 sound<select value={preferences.midMagnitudeSound} onChange={event => update({ midMagnitudeSound: event.target.value as MidMagnitudeSoundOption })} className="mt-2 block w-full rounded-xl border border-[#a8cfe3] bg-white px-3 py-2 text-sm"><option value="rapid_pulse">Rapid alert pulse</option><option value="two_tone_alert">Two-tone alert</option></select></label>
              <label className="text-sm font-bold">M6.0+ sound<select value={preferences.highMagnitudeSound} onChange={event => update({ highMagnitudeSound: event.target.value as HighMagnitudeSoundOption })} className="mt-2 block w-full rounded-xl border border-[#a8cfe3] bg-white px-3 py-2 text-sm"><option value="five_second_siren">5-second loud siren</option><option value="triple_urgent_sweep">Triple urgent sweep</option></select></label>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#d6c6e8] bg-[#f7f2fb] p-4">
            <Toggle label="Do Not Disturb schedule — mute sound" icon={<Moon size={15} />} checked={preferences.quietHoursEnabled} onChange={quietHoursEnabled => update({ quietHoursEnabled })} />
            {preferences.quietHoursEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Start time<input type="time" value={preferences.quietHoursStart} onChange={event => update({ quietHoursStart: event.target.value })} className="mt-2 block w-full rounded-xl border border-[#c6b4da] bg-white px-3 py-2 text-sm" /></label><label className="text-sm font-bold">End time<input type="time" value={preferences.quietHoursEnd} onChange={event => update({ quietHoursEnd: event.target.value })} className="mt-2 block w-full rounded-xl border border-[#c6b4da] bg-white px-3 py-2 text-sm" /></label></div>}
            <p className="mt-3 text-xs leading-5 text-slate-600">သတ်မှတ်ထားသော local device time အတွင်း app ဖွင့်ထားချိန်၏ alert sound ကိုသာ mute လုပ်ပြီး red visual alert ကိုဆက်ပြပါမယ်။ Midnight ဖြတ်သန်းသော schedule (ဥပမာ 22:00–07:00) ကိုလည်း ပံ့ပိုးပါသည်။ Start/End တူညီလျှင် schedule မလုပ်ပါ။</p>
            <p className="mt-2 text-xs font-bold text-slate-700">{preferences.quietHoursEnabled ? (preferences.quietHoursStart === preferences.quietHoursEnd ? "Quiet hours are not active because Start and End are the same." : isQuietHoursActive(quietHours) ? "Quiet hours are active now — foreground sound is muted." : `Quiet hours are set: ${preferences.quietHoursStart}–${preferences.quietHoursEnd}.`) : "Quiet hours are off."}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">App-closed browser notifications သည် ဖုန်း/OS Do Not Disturb စနစ်ကိုလိုက်နာပါသည်; ဤ local schedule က background push ကို မပြောင်းလဲပါ။</p>
          </div>

          <div className="mt-5 rounded-2xl border border-[#f0b5ae] bg-[#fff8f7] p-4">
            <p className="text-sm font-black">Quick alert test</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Current foreground settings ကိုသာ စမ်းသပ်မည်ဖြစ်ပြီး earthquake record, alert history သို့မဟုတ် background notification မဖန်တီးပါ။</p>
            <button onClick={runTestAlert} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#b42318] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#8f1d14]"><BellRing size={16} />Test Alert</button>
          </div>

          <div className="mt-5 rounded-2xl border border-[#b8d9eb] bg-[#edf7fc] p-4">
            <p className="flex items-center gap-2 text-sm font-black"><Volume2 size={16} />Magnitude sound preview</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">App ဖွင့်ထားချိန်တွင်သာ in-app sound နှင့် visual alert ရနိုင်ပါသည်။ Test controls များသည် quiet hours နှင့် visual-only mute ကိုလိုက်နာပါသည်—အသံသည် official warning level မဟုတ်ပါ။</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={testSiren} className="rounded-xl bg-[#b42318] px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-[#8f1d14]"><Volume2 className="mr-1 inline" size={14} />Test M6.0+ sound</button>
              {[4, 6].map(magnitude => <button key={magnitude} onClick={() => testSound(magnitude)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-slate-950">Test {magnitudeSoundLabel(magnitude, magnitudeSoundOptions)}</button>)}
            </div>
            <p role="status" className="mt-2 text-xs font-medium text-slate-600">{soundMessage}</p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold">Monitor regions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {JAPAN_REGIONS.map(region => <button key={region} onClick={() => toggleRegion(region)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${preferences.regions.includes(region) ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{region}</button>)}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><LocateFixed size={16} />Optional distance from you</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Your precise location is used only in this page for approximate straight-line distance and is never stored or sent to the server.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={requestLocation} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold hover:border-slate-950">Use my location</button>
              {location && <button onClick={() => { setLocation(null); setLocationMessage("Location cleared from this page."); }} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 underline">Clear location</button>}
            </div>
            <p className="mt-2 text-xs text-slate-500">{locationMessage}</p>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-extrabold tracking-[0.18em] text-slate-500">HISTORY</p><h2 className="mt-1 text-2xl font-black">Alert history</h2></div>
            <p className="text-sm font-bold text-slate-500">{alerts.length} alerts</p>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.length ? alerts.map(alert => (
              <article key={alert.alertId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold tracking-[0.15em] text-slate-500">{alert.severity.toUpperCase()} DETECTION</p>
                    <h3 className="mt-1 text-xl font-black">M{alert.eventMagnitude.toFixed(1)} · {alert.locality}</h3>
                    <p className="mt-1 text-sm text-slate-600"><MapPin className="mr-1 inline" size={14} />{alert.region} · {alert.depthKm === null ? "Depth unknown" : `${alert.depthKm.toFixed(0)} km depth`} · {localTime(alert.originTimeUtc)} (Japan time)</p>
                    {location && alert.latitude !== null && alert.longitude !== null && <p className="mt-2 text-xs font-bold text-slate-700">Distance from you: approximately {approximateDistanceKm(location, { latitude: alert.latitude, longitude: alert.longitude })} km</p>}
                  </div>
                  <span className="rounded-full bg-[#edf7fc] px-2.5 py-1 text-[10px] font-bold text-slate-700">USGS live</span>
                </div>
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{alert.reason}</p>
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <CheckCircle2 className="mx-auto text-slate-400" size={24} />
                <p className="mt-3 font-black">လက်ရှိ settings အတွက် alert မရှိသေးပါ</p>
                <p className="mt-1 text-sm text-slate-500">Alert history သည် လာမည့် USGS live collection များတွင် threshold ပြည့်သော event အသစ်များအတွက် စတင်ပေါ်လာပါမည်။</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Toggle({ label, icon, checked, onChange }: { label: string; icon: React.ReactNode; checked: boolean; onChange: (value: boolean) => void }) {
  return <button onClick={() => onChange(!checked)} className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-bold ${checked ? "border-[#9ac9e3] bg-[#edf7fc]" : "border-slate-200 bg-white"}`}><span className="flex items-center gap-2">{icon}{label}</span><span>{checked ? "On" : "Off"}</span></button>;
}
