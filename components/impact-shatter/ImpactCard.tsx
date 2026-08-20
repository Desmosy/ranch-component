import { cn } from "@/lib/utils";
import chaosAsset from "../assets/chaos.jpg";

export interface ImpactCardProps {
  width: number;
  className?: string;
}

export default function ImpactCard({
  width,
  className,
}: ImpactCardProps) {
  return (
    <div
      className={cn("select-none overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-black", className)}
      style={{ width }}
      aria-hidden="true"
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "1 / 1",
        }}
      >
        <img
          src={chaosAsset}
          alt="Chaos Artwork"
          className="absolute inset-0 h-full w-full object-cover block"
        />
      </div>
    </div>
  );
}
