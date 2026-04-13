"use client";

import Image from "next/image";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Pokemon } from "@/features/pokemon/types";
import { TypeBadge } from "./type-badge";
import { StatBar } from "./stat-bar";

export function PokemonCard({ pokemon }: { pokemon: Pokemon }) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const totalStats = Object.values(pokemon.base_stats).reduce(
    (sum, v) => sum + v,
    0
  );

  const { contextSafe } = useGSAP({ scope: cardRef });

  const handleMouseEnter = contextSafe((e: React.MouseEvent) => {
    // Holographic Tilt calculations
    const card = cardRef.current!;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const xRotation = (-y / rect.height) * 15; // Max 15deg
    const yRotation = (x / rect.width) * 15;
    
    gsap.to(card, {
      rotateX: xRotation,
      rotateY: yRotation,
      z: 50,
      scale: 1.05,
      boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)",
      ease: "power2.out",
      duration: 0.4
    });
  });

  const handleMouseLeave = contextSafe(() => {
    gsap.to(cardRef.current, {
      rotateX: 0,
      rotateY: 0,
      z: 0,
      scale: 1,
      boxShadow: "0 10px 20px rgba(0, 0, 0, 0.2)",
      ease: "elastic.out(1, 0.4)",
      duration: 1.2
    });
  });

  const handleMouseMove = contextSafe((e: React.MouseEvent) => {
    const card = cardRef.current!;
    if (gsap.isTweening(card)) return; // Allow entrance transitions to settle
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const xRotation = (-y / rect.height) * 15;
    const yRotation = (x / rect.width) * 15;
    
    gsap.to(card, {
      rotateX: xRotation,
      rotateY: yRotation,
      ease: "none",
      duration: 0.1
    });
  });

  // Calculate dynamic type tint based on primary type
  const primaryTypeColor = `var(--color-type-${pokemon.types[0]})`;

  return (
    <div 
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{ 
        "--type-tint": primaryTypeColor, 
        transformStyle: "preserve-3d" 
      } as React.CSSProperties}
      className="group relative rounded-chunky p-5 glass scrollComponent tinted-glow"
    >
      {/* Champions LED (now dynamic tinted based on type) */}
      {pokemon.champions_eligible && (
        <div 
           className="absolute top-4 right-4 led" 
           style={{ backgroundColor: primaryTypeColor, boxShadow: `0 0 12px ${primaryTypeColor}` }}
           title="Champions eligible" 
        />
      )}

      {/* Header */}
      <div className="mb-3 flex items-start gap-3" style={{ transform: "translateZ(30px)" }}>
        {pokemon.sprite_url && (
          <Image
            src={pokemon.sprite_url}
            alt={pokemon.name}
            width={56}
            height={56}
            className="image-rendering-pixelated drop-shadow-md"
            unoptimized
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[0.65rem] uppercase tracking-[0.05rem] text-on-surface-muted">
            #{String(pokemon.id).padStart(4, "0")}
          </p>
          <h3 className="truncate font-display text-lg font-semibold text-on-surface">
            {pokemon.name}
          </h3>
        </div>
      </div>

      {/* Types */}
      <div className="mb-4 flex gap-2" style={{ transform: "translateZ(20px)" }}>
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-1.5" style={{ transform: "translateZ(10px)" }}>
        {Object.entries(pokemon.base_stats).map(([stat, value]) => (
          <StatBar key={stat} stat={stat} value={value} />
        ))}
      </div>

      {/* BST footer */}
      <div className="mt-4 flex items-center justify-between" style={{ transform: "translateZ(15px)" }}>
        <span className="font-display text-[0.65rem] uppercase tracking-[0.05rem] text-on-surface-muted">
          BST
        </span>
        <span className="font-display text-sm font-semibold" style={{ color: primaryTypeColor }}>
          {totalStats}
        </span>
      </div>
    </div>
  );
}
