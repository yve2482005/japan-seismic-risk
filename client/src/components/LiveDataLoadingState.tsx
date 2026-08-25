import { LoaderCircle, Waves } from "lucide-react";

type LiveDataLoadingStateProps = {
  title: string;
  detail?: string;
  compact?: boolean;
};

export function LiveDataLoadingState({ title, detail = "Verified source data ကို စစ်ဆေးနေပါသည်။", compact = false }: LiveDataLoadingStateProps) {
  return (
    <main className="seismic-safe-page min-h-screen bg-[#f5f7f8] px-5 py-8 text-slate-950 sm:px-8 sm:py-12" role="status" aria-live="polite" aria-busy="true">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <section className={`w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10 ${compact ? "max-w-xl" : "max-w-2xl"}`}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e4f3fb] text-[#14567d]">
            <Waves size={25} aria-hidden="true" />
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-lg font-black sm:text-xl">
            <LoaderCircle className="animate-spin text-[#2782b5]" size={19} aria-hidden="true" />
            <span>{title}</span>
          </div>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">{detail}</p>
          <div className="mx-auto mt-7 grid max-w-md gap-2" aria-hidden="true">
            <span className="live-loading-skeleton h-3 rounded-full" />
            <span className="live-loading-skeleton h-3 w-4/5 rounded-full" />
            <span className="live-loading-skeleton h-3 w-3/5 rounded-full" />
          </div>
          <p className="mt-6 text-[11px] font-bold tracking-[0.08em] text-slate-400">USGS LIVE SOURCE · NO FABRICATED DATA</p>
        </section>
      </div>
    </main>
  );
}

export function LiveDataErrorState({ title, detail, onRetry }: { title: string; detail: string; onRetry: () => void }) {
  return (
    <main className="seismic-safe-page min-h-screen bg-[#f5f7f8] px-5 py-8 text-slate-950 sm:px-8 sm:py-12" role="alert">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <section className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-700"><Waves size={25} aria-hidden="true" /></div>
          <h1 className="mt-5 text-xl font-black">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
          <button type="button" onClick={onRetry} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-slate-950">ပြန်စစ်ရန်</button>
        </section>
      </div>
    </main>
  );
}
