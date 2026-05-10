"use client";

import { useClimateStream } from "@/hooks/useClimateStream";
import { useClimateStore } from "@/store";

export default function StreamStatus() {
  useClimateStream(); // mounts global WS connection
  const { isStreamConnected, lastUpdated } = useClimateStore();

  if (!lastUpdated) return null;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
          isStreamConnected ? "bg-[#10B981] animate-pulse" : "bg-gray-600"
        }`}
      />
      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-600">
        {isStreamConnected ? "STREAM" : "POLL"}
      </span>
    </div>
  );
}
