"use client";

import { ArrowLeft } from "lucide-react";
import RakingLight from "./RakingLight";

export default function RakingLightPreview() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#EFE6D4]">
      <RakingLight className="absolute inset-0" />
      <a
        href="/ranch"
        aria-label="Back to Ranch"
        className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#171310] text-[#EFE6D4] transition hover:scale-105"
      >
        <ArrowLeft size={16} />
      </a>
    </main>
  );
}
