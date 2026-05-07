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
      className={`inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-accent px-3 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.14em] text-on-surface shadow-[2px_2px_0_var(--color-outline-variant)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--color-outline-variant)] ${className}`}
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
