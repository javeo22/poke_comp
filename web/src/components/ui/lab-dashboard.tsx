"use client";

import React from "react";
import Image from "next/image";
import { pokeArt } from "@/lib/sprites";

interface LabDashboardProps {
  children: React.ReactNode;
}

/**
 * LabDashboard: The foundational layout container for the "Regulation M-A" aesthetic.
 * Implements a high-density dot grid, scan-line overlays, and background mascots.
 */
export function LabDashboard({ children }: LabDashboardProps) {
  return (
    <div className="relative min-h-screen w-full bg-surface-lowest">
      {/* 1. Magenta-tinted Dot Grid Background */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(255, 45, 122, 0.08) 0%, transparent 80%),
            radial-gradient(rgba(255, 45, 122, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 20px 20px'
        }}
      />

      {/* 2. Scan Lines Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.02] z-10"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            #000 0px,
            #000 1px,
            transparent 1px,
            transparent 2px
          )`
        }}
      />

      {/* 3. Background Mascots */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Incineroar (727) - Bottom Left */}
        <div className="absolute -bottom-48 -left-48 w-[800px] h-[800px] opacity-[0.05] grayscale blur-[2px]">
          <Image
            src={pokeArt(727)}
            alt=""
            fill
            unoptimized
            className="object-contain"
            priority
          />
        </div>

        {/* Kingambit (983) - Top Right */}
        <div className="absolute -top-48 -right-48 w-[900px] h-[900px] opacity-[0.05] grayscale blur-[2px]">
          <Image
            src={pokeArt(983)}
            alt=""
            fill
            unoptimized
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* 4. Content */}
      <div className="relative z-20">
        {children}
      </div>

      {/* 5. Decorative UI Brackets */}
      <div className="fixed top-8 left-8 w-16 h-16 border-t border-l border-primary/10 pointer-events-none z-30" />
      <div className="fixed top-8 right-8 w-16 h-16 border-t border-r border-primary/10 pointer-events-none z-30" />
      <div className="fixed bottom-8 left-8 w-16 h-16 border-b border-l border-primary/10 pointer-events-none z-30" />
      <div className="fixed bottom-8 right-8 w-16 h-16 border-b border-r border-primary/10 pointer-events-none z-30" />
    </div>
  );
}
