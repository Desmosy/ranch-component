"use client";

import { ArrowLeft } from "lucide-react";
import Following from "./Following";

export default function FollowingPreview() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#171613] p-6">
      <div className="aspect-square h-full max-h-[92vh] max-w-[92vw]">
        <Following className="h-full w-full" />
      </div>
      <a
        href="/ranch"
        aria-label="Back to Ranch"
        className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F0EBE1] text-[#141210] transition hover:scale-105"
      >
        <ArrowLeft size={16} />
      </a>
    </main>
  );
}
