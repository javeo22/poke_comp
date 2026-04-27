import Image from "next/image";
import Link from "next/link";

interface SupportPillProps {
  onClick?: () => void;
  className?: string;
}

export function SupportPill({ onClick, className = "" }: SupportPillProps) {
  return (
    <Link
      href="/support"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent/20 hover:border-accent/60 ${className}`}
      title="Support PokeComp"
    >
      <Image
        src="/sprites/items/potion.png"
        alt=""
        width={18}
        height={18}
        className="image-rendering-pixelated"
        unoptimized
      />
      <span className="hidden sm:inline">Buy me a Potion</span>
      <span className="sm:hidden">Potion</span>
    </Link>
  );
}
