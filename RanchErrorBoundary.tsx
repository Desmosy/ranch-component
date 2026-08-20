"use client";

import React from "react";

/**
 * Failure surface for Ranch experiments.
 *
 * A React error boundary alone is not enough here. Almost every piece in Ranch
 * does its work inside a requestAnimationFrame loop, and a throw inside rAF
 * never passes through React — the component stays mounted, the canvas freezes
 * or goes blank, and the only trace is a console line nobody has open. So this
 * catches three separate channels and renders all of them the same way:
 *
 *   1. render/lifecycle errors, via componentDidCatch
 *   2. uncaught runtime errors, via window "error" (this is the rAF one)
 *   3. rejected promises, via window "unhandledrejection"
 *
 * It reports rather than recovers. A frozen canvas with a legible cause beats a
 * blank rectangle, and pretending to retry a broken WebGL context would only
 * hide the thing worth reading.
 */

interface Report {
  name: string;
  message: string;
  stack?: string;
  /** Where it came from, so the channel itself is part of the diagnosis. */
  origin: "render" | "runtime" | "promise";
  source?: string;
  at: string;
}

interface Props {
  children: React.ReactNode;
  /** Named in the panel, so a report says which experiment failed. */
  label?: string;
}

interface State {
  reports: Report[];
}

const MAX_REPORTS = 6;

export default class RanchErrorBoundary extends React.Component<Props, State> {
  state: State = { reports: [] };

  private onError = (e: ErrorEvent) => {
    this.push({
      name: e.error?.name ?? "Error",
      message: e.error?.message ?? e.message ?? "Unknown error",
      stack: e.error?.stack,
      origin: "runtime",
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
      at: new Date().toLocaleTimeString(),
    });
  };

  private onRejection = (e: PromiseRejectionEvent) => {
    const r = e.reason;
    this.push({
      name: r?.name ?? "UnhandledRejection",
      message: r?.message ?? String(r),
      stack: r?.stack,
      origin: "promise",
      at: new Date().toLocaleTimeString(),
    });
  };

  private push(report: Report) {
    this.setState((s) => {
      // Identical repeats are the norm for a loop that throws every frame —
      // collapse them or the panel becomes the thing that crashes the page.
      const dupe = s.reports.some(
        (r) => r.message === report.message && r.origin === report.origin,
      );
      if (dupe) return s;
      return { reports: [...s.reports, report].slice(-MAX_REPORTS) };
    });
  }

  componentDidMount() {
    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onRejection);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.push({
      name: error.name,
      message: error.message,
      stack: `${error.stack ?? ""}\n\nComponent stack:${info.componentStack ?? ""}`,
      origin: "render",
      at: new Date().toLocaleTimeString(),
    });
  }

  static getDerivedStateFromError(): Partial<State> {
    return {};
  }

  private copy = () => {
    const text = this.state.reports
      .map(
        (r) =>
          `[${r.at}] ${r.origin.toUpperCase()} ${r.name}: ${r.message}\n${r.source ?? ""}\n${r.stack ?? "(no stack)"}`,
      )
      .join("\n\n---\n\n");
    void navigator.clipboard?.writeText(text);
  };

  render() {
    const { reports } = this.state;
    const fatal = reports.some((r) => r.origin === "render");

    return (
      <>
        {/* A runtime error does not necessarily kill the tree, so the children
            stay mounted unless the failure was in render. */}
        {fatal ? null : this.props.children}

        {reports.length > 0 && (
          <div
            role="alert"
            className="fixed inset-x-0 bottom-0 z-[9999] max-h-[55vh] overflow-auto border-t-2 border-red-500 bg-[#1A0E0E] p-4 font-mono text-[12px] text-red-100 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-[11px] uppercase tracking-[0.18em] text-red-300">
                {this.props.label ?? "Ranch"} — {reports.length} error
                {reports.length > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={this.copy}
                  className="rounded border border-red-400/40 px-2 py-1 text-[11px] text-red-200 transition-colors hover:bg-red-400/10"
                >
                  Copy all
                </button>
                <button
                  onClick={() => this.setState({ reports: [] })}
                  className="rounded border border-red-400/40 px-2 py-1 text-[11px] text-red-200 transition-colors hover:bg-red-400/10"
                >
                  Dismiss
                </button>
                <a
                  href="/ranch"
                  className="rounded border border-red-400/40 px-2 py-1 text-[11px] text-red-200 transition-colors hover:bg-red-400/10"
                >
                  Back to Ranch
                </a>
              </div>
            </div>

            {reports.map((r, i) => (
              <div key={i} className="mb-3 border-l-2 border-red-500/50 pl-3">
                <div className="text-red-300">
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] uppercase">
                    {r.origin}
                  </span>{" "}
                  <span className="font-semibold text-red-200">{r.name}</span>{" "}
                  <span className="text-red-400/70">{r.at}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-red-50">
                  {r.message}
                </div>
                {r.source && <div className="mt-1 text-red-400/80">{r.source}</div>}
                {r.stack && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-red-300/70">
                    {r.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
}
