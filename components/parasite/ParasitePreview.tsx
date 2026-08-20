"use client";

import { ArrowLeft } from "lucide-react";
import Parasite from "./Parasite";

export default function ParasitePreview() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#17150F] p-6">
      <div className="aspect-square h-full max-h-[92vh] max-w-[92vw]">
        <Parasite className="h-full w-full" />
      </div>
      <a
        href="/ranch"
        aria-label="Back to Ranch"
        className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F0EBE0] text-[#141210] transition hover:scale-105"
      >
        <ArrowLeft size={16} />
      </a>
    </main>
  );
}
