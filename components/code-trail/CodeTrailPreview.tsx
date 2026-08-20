"use client";

import { Github, Home } from "lucide-react";
import CodeTrail from "./CodeTrail";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

export default function CodeTrailPreview() {
  return (
    <main className="min-h-screen bg-black p-6 font-sans text-slate-100 md:p-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Code Trail</h1>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              A ribbon of code fragments on tonal bars, chained to the pointer.
            </p>
          </div>
          <nav className="flex items-center gap-2">
            <a
              href="/ranch"
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              <Home size={15} /> Ranch
            </a>
            <a
              href={RANCH_GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              <Github size={15} /> Source
            </a>
          </nav>
        </header>

        <CodeTrail className="border border-white/10" />
      </div>
    </main>
  );
}
