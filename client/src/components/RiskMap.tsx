import type { JapanRegion, RegionActivity } from "@shared/seismic";
import { cn } from "@/lib/utils";

const fills = { LOW: "#c8dded", MODERATE: "#f7c7c2", ELEVATED: "#ef8e85", HIGH: "#dc5d54" } as const;

export function RiskMap({
  regions,
  selected,
  onSelect,
}: {
  regions: RegionActivity[];
  selected: JapanRegion;
  onSelect: (region: JapanRegion) => void;
}) {
  return (
    <div className="map-shell" aria-label="Schematic interactive Japan regional activity map">
      <svg viewBox="0 0 360 410" className="h-auto w-full max-h-[420px]" role="img" aria-labelledby="map-title map-description">
        <title id="map-title">Japan regional model-derived activity estimates</title>
        <desc id="map-description">A schematic regional map. Select a region to inspect its demonstration activity and probability estimate.</desc>
        <path d="M285 38 L325 42 L342 67 L323 96 L286 90 L272 64 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M282 102 L318 110 L313 185 L286 208 L271 179 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M259 197 L285 205 L276 237 L250 241 L239 220 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M193 218 L244 220 L255 244 L233 265 L193 259 L175 239 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M137 242 L184 240 L195 264 L168 280 L140 270 L122 254 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M76 244 L126 253 L137 271 L96 278 L58 266 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M140 285 L187 278 L206 293 L176 309 L140 305 L122 295 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M53 283 L96 277 L121 300 L110 332 L78 344 L49 318 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        <path d="M18 348 L38 346 L54 357 L39 373 L19 368 Z" fill="#ecf2f5" stroke="#101010" strokeWidth="1.2" />
        {regions.map(item => (
          <g
            key={item.region}
            role="button"
            tabIndex={0}
            aria-label={`${item.region}, ${item.risk}, ${item.probabilityM4_24h.toFixed(1)} percent M4 plus demonstration probability in 24 hours`}
            onClick={() => onSelect(item.region)}
            onKeyDown={event => event.key === "Enter" || event.key === " " ? onSelect(item.region) : null}
            className="cursor-pointer outline-none"
          >
            <circle cx={item.svgX} cy={item.svgY} r={selected === item.region ? 16 : 12} fill={fills[item.risk]} stroke="#101010" strokeWidth={selected === item.region ? 2.4 : 1.3} className="transition-all duration-200" />
            <text x={item.svgX} y={item.svgY + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#101010">{item.events24h}</text>
          </g>
        ))}
        <text x="14" y="399" fontSize="9" fill="#667085">Schematic view · circle = events in 24h (demo)</text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600">
        {Object.entries(fills).map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border border-black/30" style={{ backgroundColor: color }} />{label}</span>)}
      </div>
      <p className={cn("mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-600", "border border-slate-200")}>Risk bands are configurable product thresholds derived from model probabilities; they are not official warnings or forecasts.</p>
    </div>
  );
}
