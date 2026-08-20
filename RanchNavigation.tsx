import { ArrowLeft, Github, Home } from "lucide-react";

export const RANCH_GITHUB_URL = "https://github.com/Desmosy/ranch";

export default function RanchNavigation({ compact = false }: { compact?: boolean }) {
  const itemClass = compact
    ? "inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 text-sm font-medium text-white/85 backdrop-blur-md transition hover:border-white/30 hover:bg-black/70 hover:text-white"
    : "inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black px-3 text-sm font-medium text-slate-200 shadow-sm transition hover:border-white/20 hover:bg-white/5 hover:text-white";
  const mutedClass = compact
    ? "cursor-not-allowed border-white/10 bg-black/25 text-white/35"
    : "cursor-not-allowed border-white/10 bg-black text-slate-600";
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/ranch";
  };

  return (
    <nav className="flex items-center gap-2" aria-label="Ranch navigation">
      {compact ? (
        <button type="button" onClick={handleBack} className={itemClass}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      ) : (
        <a href="/" className={itemClass}>
          <Home className="h-4 w-4" aria-hidden="true" />
          Home
        </a>
      )}
      {RANCH_GITHUB_URL ? (
        <a
          href={RANCH_GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className={itemClass}
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          Ranch on GitHub
        </a>
      ) : (
        <span
          className={`${itemClass} ${mutedClass}`}
          title="The Ranch GitHub link is coming soon"
          aria-disabled="true"
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          Ranch on GitHub
        </span>
      )}
    </nav>
  );
}
