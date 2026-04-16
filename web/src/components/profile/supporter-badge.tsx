import Image from "next/image";

interface SupporterBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

export function SupporterBadge({ size = "md", className = "" }: SupporterBadgeProps) {
  const iconPx = size === "sm" ? 12 : 14;
  const paddingY = size === "sm" ? "py-0.5" : "py-1";
  const textSize = size === "sm" ? "text-[0.55rem]" : "text-[0.6rem]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-tertiary/40 bg-tertiary/10 px-2 ${paddingY} font-display ${textSize} uppercase tracking-wider text-tertiary ${className}`}
      title="PokeComp Supporter"
    >
      <Image
        src="/sprites/items/potion.png"
        alt=""
        width={iconPx}
        height={iconPx}
        className="image-rendering-pixelated"
        unoptimized
      />
      Supporter
    </span>
  );
}
