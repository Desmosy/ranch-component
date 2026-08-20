"use client";

import { useEffect } from "react";
import { Github, Home } from "lucide-react";
import Clearing from "./Clearing";
import { RANCH_GITHUB_URL } from "../../RanchNavigation";

export default function ClearingPreview() {
  useEffect(() => {
    const bodyCursor = document.body.style.cursor;
    const docCursor = document.documentElement.style.cursor;
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    document.body.classList.add("force-default-cursor");
    return () => {
      document.body.style.cursor = bodyCursor;
      document.documentElement.style.cursor = docCursor;
      document.body.classList.remove("force-default-cursor");
    };
  }, []);

  return (
    <div className="flex h-screen max-h-screen w-screen max-w-screen cursor-default flex-col items-center justify-between overflow-hidden bg-white p-3 font-sans text-neutral-900 sm:p-6">
      <style>{`
        html, body {
          overflow: hidden !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .force-default-cursor,
        .force-default-cursor body,
        .force-default-cursor canvas,
        .force-default-cursor div { cursor: default !important; }
        .force-default-cursor a, .force-default-cursor button { cursor: pointer !important; }
        .modern-cursor, #modern-cursor, [data-custom-cursor] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>

      <div className="flex w-full max-w-[84vw] flex-none items-center justify-between px-1 py-1">
        <a
          href="/ranch"
          className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <Home className="h-3.5 w-3.5" />
          Ranch
        </a>
        <a
          href={RANCH_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium tracking-tight text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </div>

      <div className="my-2 flex w-full min-h-0 max-w-[84vw] flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-3">
        <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-neutral-200/60">
          <Clearing className="absolute inset-0" />
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-3">
          <div className="flex flex-wrap items-center gap-3 text-xs sm:gap-4">
            <span className="text-[13px] font-medium tracking-tight text-neutral-900">
              Clearing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
