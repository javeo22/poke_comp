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
      className={`inline-flex items-center gap-1.5 rounded-lg border border-tertiary/40 bg-tertiary/10 px-3 py-1.5 font-display text-xs uppercase tracking-wider text-tertiary transition-colors hover:bg-tertiary/20 hover:border-tertiary/60 ${className}`}
      title="Support PokeComp on Ko-fi"
    >
      <Image
        src="/sprites/items/potion.png"
        alt=""
        width={20}
        height={20}
        className="image-rendering-pixelated"
        unoptimized
      />
      <span className="hidden sm:inline">Buy Me a Coffee</span>
      <span className="sm:hidden">Coffee</span>
    </Link>
  );
}
