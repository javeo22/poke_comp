import React from "react";

interface LabDashboardProps {
  children: React.ReactNode;
}

export function LabDashboard({ children }: LabDashboardProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-surface">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(135deg, rgba(232, 225, 210, 0.78) 0 1px, transparent 1px 18px),
            linear-gradient(180deg, rgba(255,255,255,0.42), rgba(244,239,229,0.7))
          `,
          backgroundSize: "100% 100%, 100% 100%",
        }}
      />

      <div className="relative z-20">
        {children}
      </div>
    </div>
  );
}
