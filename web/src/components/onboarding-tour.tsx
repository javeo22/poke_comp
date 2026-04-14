"use client";

import { useState } from "react";

const STORAGE_KEY = "pokecomp_onboarded";

const TOUR_STEPS = [
  {
    title: "Browse the Pokedex",
    description:
      "Explore all 186 Champions-eligible Pokemon. Filter by type, search by name, and click any card to see full stats, movepool, and abilities.",
    href: "/pokemon",
    tag: "Game Data",
  },
  {
    title: "Build Your Roster",
    description:
      "Track the Pokemon you own in Champions. Set abilities, moves, natures, and stat points. Mark builds as built, training, or wishlist.",
    href: "/roster",
    tag: "My Collection",
  },
  {
    title: "Create Teams",
    description:
      "Assemble your team of 6 from your roster. Designate a Mega, tag your archetype, and view type coverage at a glance.",
    href: "/teams",
    tag: "My Collection",
  },
  {
    title: "Get AI Draft Help",
    description:
      "Paste your opponent's 6 Pokemon, select your team, and get AI-powered recommendations: which 4 to bring, lead pair, threats, and a full game plan.",
    href: "/draft",
    tag: "Compete",
  },
  {
    title: "Track Your Results",
    description:
      "Log wins and losses after each match. View your win rate overall, by team, and by opponent Pokemon to find your blind spots.",
    href: "/matches",
    tag: "Compete",
  },
];

function getInitialShowState(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(STORAGE_KEY);
}

export function OnboardingTour() {
  const [show, setShow] = useState(getInitialShowState);
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
    setStep(0);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  if (!show) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md">
        <div className="card p-8 shadow-2xl">
          {/* Step indicator */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-surface-high"
                  }`}
                />
              ))}
            </div>
            <span className="font-display text-[0.6rem] uppercase tracking-widest text-on-surface-muted">
              {step + 1} / {TOUR_STEPS.length}
            </span>
          </div>

          {/* Tag */}
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 font-display text-[0.6rem] uppercase tracking-widest text-primary">
            {current.tag}
          </span>

          {/* Content */}
          <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-on-surface">
            {current.title}
          </h2>
          <p className="mb-8 font-body text-sm leading-relaxed text-on-surface-muted">
            {current.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="font-display text-xs uppercase tracking-wider text-on-surface-muted hover:text-on-surface transition-colors"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="btn-ghost px-4 py-2 font-display text-xs uppercase tracking-wider"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="btn-primary px-6 py-2 font-display text-xs uppercase tracking-wider"
              >
                {isLast ? "Get Started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reset the onboarding tour so it shows again on next page load.
 * Called from the nav "?" button.
 */
export function resetOnboardingTour() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}
