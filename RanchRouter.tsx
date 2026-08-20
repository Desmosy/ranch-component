import RanchIndex from "./RanchIndex";
import RanchErrorBoundary from "./RanchErrorBoundary";
import PrismAtomPreview from "./components/prism-atom/PrismAtomPreview";
import TempleChimePreview from "./components/temple-chime/TempleChimePreview";
import HoloCardPreview from "./components/holo-card/HoloCardPreview";
import CraftPixelDemo from "./components/craft-pixel/CraftPixelDemo";
import PixelFireDemo from "./components/pixel-fire/PixelFireDemo";
import CurvedTimelinePreview from "./components/curved-timeline/CurvedTimelinePreview";
import ImpactShatterPreview from "./components/impact-shatter/ImpactShatterPreview";
import CodeTrailPreview from "./components/code-trail/CodeTrailPreview";
import TruchetWeavePreview from "./components/truchet-weave/TruchetWeavePreview";
import RakingLightPreview from "./components/raking-light/RakingLightPreview";
import SpecimenPreview from "./components/specimen/SpecimenPreview";
import FollowingPreview from "./components/following/FollowingPreview";
import ParasitePreview from "./components/parasite/ParasitePreview";
import TokenfallPreview from "./components/tokenfall/TokenfallPreview";
import ClearingPreview from "./components/clearing/ClearingPreview";
import CipherPreview from "./components/cipher/CipherPreview";
import MirrorGlobePreview from "./components/mirror-globe/MirrorGlobePreview";
import ChromaticFlowPreview from "./components/chromatic-flow/ChromaticFlowPreview";
import MotionPressDemo from "./components/motion-press/MotionPressDemo";
import HandLensDemo from "./components/hand-lens/HandLensDemo";
import BaseIntroPreview from "./components/base-intro/BaseIntroPreview";

function route(slug: string) {
  if (slug === "") {
    return <RanchIndex />;
  }

  if (
    slug === "base-intro" ||
    slug === "base" ||
    slug === "intro" ||
    slug === "title-sequence" ||
    slug === "splash"
  ) {
    return <BaseIntroPreview />;
  }

  if (
    slug === "hand-lens" ||
    slug === "pinch" ||
    slug === "hands" ||
    slug === "hand-seal"
  ) {
    return <HandLensDemo />;
  }

  if (
    slug === "motion-press" ||
    slug === "motion" ||
    slug === "blob-tracking" ||
    slug === "optical-flow" ||
    slug === "press"
  ) {
    return <MotionPressDemo />;
  }

  if (
    slug === "chromatic-flow" ||
    slug === "kinetic-chroma" ||
    slug === "witchs-shot" ||
    slug === "witch-shot" ||
    slug === "flow" ||
    slug === "art"
  ) {
    return <ChromaticFlowPreview />;
  }

  if (slug === "curved-timeline" || slug === "hover-timeline" || slug === "timeline") {
    return <CurvedTimelinePreview />;
  }

  if (slug === "craft-pixel" || slug === "craft-pixel-art" || slug === "pixel") {
    return <CraftPixelDemo />;
  }

  if (slug === "craft-fire" || slug === "pixel-fire" || slug === "pixel-fire-footer" || slug === "fire") {
    return <PixelFireDemo />;
  }

  if (slug === "prism-atom") {
    return <PrismAtomPreview />;
  }

  if (slug === "temple-chime") {
    return <TempleChimePreview />;
  }

  if (slug === "holo-card") {
    return <HoloCardPreview />;
  }

  if (slug === "impact-shatter") {
    return <ImpactShatterPreview />;
  }

  if (slug === "code-trail" || slug === "code-ribbon") {
    return <CodeTrailPreview />;
  }

  if (slug === "truchet-weave" || slug === "weave" || slug === "truchet") {
    return <TruchetWeavePreview />;
  }

  if (slug === "raking-light" || slug === "shadows" || slug === "sundial") {
    return <RakingLightPreview />;
  }

  if (slug === "specimen") {
    return <SpecimenPreview />;
  }

  if (slug === "following" || slug === "trajectories") {
    return <FollowingPreview />;
  }

  if (slug === "parasite" || slug === "mathematical-parasite") {
    return <ParasitePreview />;
  }

  if (slug === "tokenfall" || slug === "glyph-rain") {
    return <TokenfallPreview />;
  }

  if (slug === "clearing" || slug === "goo") {
    return <ClearingPreview />;
  }

  if (slug === "cipher" || slug === "cube") {
    return <CipherPreview />;
  }

  if (slug === "mirror-globe" || slug === "globe") {
    return <MirrorGlobePreview />;
  }

  // Not found
  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans text-slate-500 bg-gray-50 dark:bg-black">
      <h2 className="text-2xl font-bold mb-4">404 - Not Found</h2>
      <p className="mb-6">Experiment "{slug}" was not found in Ranch.</p>
      <a href="/ranch" className="text-blue-600 hover:underline">
        Return to Ranch
      </a>
    </div>
  );
}

export default function RanchRouter() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const slug = pathname.replace(/^\/ranch\/?/, "");

  // Every experiment is wrapped, including the index — the index tiles run the
  // same canvases the detail pages do, and a tile that throws would otherwise
  // take the whole gallery down with nothing on screen to say why.
  return (
    <RanchErrorBoundary label={slug || "ranch/index"}>{route(slug)}</RanchErrorBoundary>
  );
}
