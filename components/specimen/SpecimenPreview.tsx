"use client";

import { ArrowLeft } from "lucide-react";
import Specimen from "./Specimen";

export default function SpecimenPreview() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#1B1916] p-6">
      <div className="aspect-[500/650] h-full max-h-[92vh]">
        <Specimen className="h-full w-full" />
      </div>
      <a
        href="/ranch"
        aria-label="Back to Ranch"
        className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F2EDE3] text-[#15120D] transition hover:scale-105"
      >
        <ArrowLeft size={16} />
      </a>
    </main>
  );
}
