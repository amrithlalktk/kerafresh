import { TreePalm } from "lucide-react";

// Kera (coconut/palm) + fresh (produce) — a palm-tree mark in the app's
// fresh-green tone, paired with a two-tone wordmark.
const LEAF_GREEN = "#1baf7a";

export default function Logo({
  showText = true,
  iconSize = 32,
}: {
  showText?: boolean;
  iconSize?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: LEAF_GREEN, width: iconSize, height: iconSize }}
      >
        <TreePalm size={Math.round(iconSize * 0.6)} strokeWidth={2.25} />
      </span>
      {showText && (
        <span className="text-base font-semibold tracking-tight">
          <span className="text-black">Kera</span>
          <span style={{ color: LEAF_GREEN }}>fresh</span>
        </span>
      )}
    </div>
  );
}
