import React from 'react';
import { Info, EyeOff } from 'lucide-react';

interface AdBannerProps {
  enabled: boolean;
  slotId: string;
  placementLabel: string;
  onToggleAds: () => void;
  onOpenAdPolicy: () => void;
}

/**
 * Configurable Ad-Supported Stream Placeholder
 * Clearly labeled architectural slot for future ad-network integration.
 * Never renders fake commercial claims, misleading buttons, or mid-video interruptions.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  enabled,
  slotId,
  placementLabel,
  onToggleAds,
  onOpenAdPolicy,
}) => {
  if (!enabled) {
    return null;
  }

  return (
    <aside
      aria-label={`Advertisement placeholder: ${placementLabel}`}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8"
    >
      <div className="rounded-xl border border-zinc-800/80 bg-[#111115] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-tabular">
            <span>SPONSORED SLOT PLACEHOLDER</span>
            <span aria-hidden="true">·</span>
            <span>SLOT ID: {slotId}</span>
            <span aria-hidden="true">·</span>
            <span>NO LIVE AD NETWORK CONNECTED</span>
          </div>
          <p className="text-sm text-zinc-300">
            Reserved layout container for {placementLabel}. CineWave is designed as a free, ad-supported streaming platform; no commercial ad provider is currently active in this demo environment.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdPolicy}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-700/80 text-xs font-medium text-zinc-200 hover:bg-zinc-800/70 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Ad Architecture Info</span>
          </button>
          <button
            type="button"
            onClick={onToggleAds}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-zinc-800/90 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-700/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Hide ad slot placeholders during this session"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide Ad Slots</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
