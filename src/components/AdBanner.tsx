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
 * Configurable Display Ad Slot Placeholder
 * Clearly labeled architectural slot for display ad-network integration,
 * kept strictly separate from Google IMA HTML5 video ad breaks.
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
      className="w-full max-w-7xl mx-auto my-6"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-[#1A1625] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono-tabular">
            <span>DISPLAY SPONSOR SLOT PLACEHOLDER</span>
            <span aria-hidden="true">·</span>
            <span>SLOT ID: {slotId}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#B892FF]">SEPARATED FROM VIDEO PLAYER ADS</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300">
            Reserved layout container for {placementLabel}. ZAPPY separates page display banner placeholders from in-player Google IMA HTML5 VAST video ads; no commercial ad revenue is claimed until an approved ad provider is configured.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdPolicy}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-white/10 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-[#B892FF]" />
            <span>Ad Architecture Info</span>
          </button>
          <button
            type="button"
            onClick={onToggleAds}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#241E33] text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#2E2740] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Hide display ad slot placeholders during this session"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide Display Slots</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
