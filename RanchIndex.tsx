import PrismAtom from "./components/prism-atom/PrismAtom";
import TempleChime from "./components/temple-chime/TempleChime";
import HoloCard from "./components/holo-card/HoloCard";
import CraftPixelCanvas from "./components/craft-pixel/CraftPixelCanvas";
import PixelFireCanvas from "./components/pixel-fire/PixelFireCanvas";
import CurvedTimeline from "./components/curved-timeline/CurvedTimeline";
import ImpactShatter from "./components/impact-shatter/ImpactShatter";
import CodeTrail from "./components/code-trail/CodeTrail";
import TruchetWeave from "./components/truchet-weave/TruchetWeave";
import RakingLight from "./components/raking-light/RakingLight";
import Specimen from "./components/specimen/Specimen";
import Following from "./components/following/Following";
import Parasite from "./components/parasite/Parasite";
import Tokenfall from "./components/tokenfall/Tokenfall";
import Clearing from "./components/clearing/Clearing";
import Cipher from "./components/cipher/Cipher";
import MirrorGlobe from "./components/mirror-globe/MirrorGlobe";
import ChromaticFlow from "./components/chromatic-flow/ChromaticFlow";
import MotionPress from "./components/motion-press/MotionPress";
import HandLens from "./components/hand-lens/HandLens";
import BaseIntro from "./components/base-intro/BaseIntro";
import RanchNavigation from "./RanchNavigation";

export default function RanchIndex() {
  return (
    <main className="min-h-screen bg-black p-6 font-sans text-slate-100 md:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
              Ranch
            </h1>
            <p className="text-slate-400">
              A collection of handcrafted components and experiments.
            </p>
          </div>
          <RanchNavigation />
        </header>

        <section aria-label="Ranch experiments" className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <a href="/ranch/base-intro" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm transition-all duration-300 group-hover:border-white/30 group-hover:shadow-md">
                <BaseIntro loop text="base" className="absolute inset-0 h-full w-full" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Base Intro
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/hand-lens" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#efe7d6] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <HandLens ink="sumi" demo compact showSkeleton className="absolute inset-0 h-full w-full" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Hand Lens
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/motion-press" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#f2e9d5] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <MotionPress
                  palette="riso"
                  lens="overprint"
                  blobCount={5}
                  showHud={false}
                  compact
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Motion Press
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/chromatic-flow" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <ChromaticFlow />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Kinetic Chromatica
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/curved-timeline" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white text-black shadow-sm transition-all duration-300 group-hover:border-white/30 group-hover:shadow-md p-4">
                <CurvedTimeline defaultActiveIndex={2} className="scale-75 origin-center" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Minimal Curved Timeline
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/prism-atom" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <PrismAtom
                  aria-hidden="true"
                  rings={3}
                  orbitSpeed={0.9}
                  precession={0.06}
                  ringWidth={0.3}
                  aberration={0.012}
                  glow={1}
                  nucleus={1}
                  flare={0}
                  scale={0.62}
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Prism Atom
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/temple-chime" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <TempleChime
                  scale={0.9}
                  lengthScale={0.75}
                  coverage={0.85}
                  roofSpan={0.45}
                  mouseRadius={80}
                  muted
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Temple Chime
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/pixel-fire" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white text-black shadow-sm transition-all duration-300 group-hover:border-white/30 group-hover:shadow-md">
                <PixelFireCanvas palette="inferno" cellSize="S" brushSize="M" className="absolute inset-0 w-full h-full" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Craft Pixel Fire
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/craft-pixel" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white text-black shadow-sm transition-all duration-300 group-hover:border-white/30 group-hover:shadow-md">
                <CraftPixelCanvas cellSize="S" brushSize="M" design="wiener" className="absolute inset-0 w-full h-full" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Craft Pixel Art
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/holo-card" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <HoloCard idle className="h-[86%]" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Holo Card
                </span>
              </div>
            </article>
          </a>

          <a href="/ranch/impact-shatter" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <ImpactShatter
                  autoPlay
                  headline="Perfection is static, beauty lives in chaos"
                  spread={0.75}
                  chaos={0.6}
                  cardScale={0.3}
                />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Impact Shatter
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/code-trail" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0C0C0E] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <CodeTrail className="absolute inset-0 h-full w-full rounded-none" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Code Trail
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/truchet-weave" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#EFE7D7] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <TruchetWeave className="absolute inset-0" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Truchet Weave
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/raking-light" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#EFE6D4] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <RakingLight className="absolute inset-0" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Raking Light
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/specimen" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1B1916] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <div className="aspect-[500/650] h-full py-2">
                  <Specimen className="h-full w-full" />
                </div>
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Specimen / Following
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/following" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#171613] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <div className="aspect-square h-full py-2">
                  <Following className="h-full w-full" />
                </div>
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Following
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/parasite" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#17150F] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <div className="aspect-square h-full py-2">
                  <Parasite className="h-full w-full" />
                </div>
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Mathematical Parasite
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/tokenfall" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#DCD5CF] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <Tokenfall className="absolute inset-0" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Tokenfall
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/clearing" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#F7F5F1] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <Clearing className="absolute inset-0" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Clearing
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/cipher" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0A] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <Cipher className="absolute inset-0" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Cipher
                </span>
              </div>
            </article>
          </a>
          <a href="/ranch/mirror-globe" className="group flex flex-col gap-3 outline-none">
            <article className="overflow-hidden">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#050505] shadow-sm transition-all duration-300 group-hover:border-white/20 group-hover:shadow-md">
                <MirrorGlobe palette="aurora" stampMode="hand" globeSize={0.65} flowSpeed={0.5} className="absolute inset-0 w-full h-full" />
              </div>
              <div className="flex items-center px-1 pt-3 text-sm text-slate-400">
                <span className="font-medium text-white group-hover:underline">
                  Mirror Globe
                </span>
              </div>
            </article>
          </a>
        </section>
      </div>
    </main>
  );
}
