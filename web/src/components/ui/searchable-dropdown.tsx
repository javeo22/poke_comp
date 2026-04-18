"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  section?: string;
}

interface SearchableDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
}

export function SearchableDropdown({
  label,
  placeholder = "Search...",
  value,
  onChange,
  options,
  disabled = false,
}: SearchableDropdownProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : options;

  const displayValue = value
    ? options.find((o) => o.value === value)?.label ?? value
    : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = (opt: DropdownOption) => {
    onChange(opt.value);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setQuery("");
        break;
    }
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={isOpen ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Select a Pokemon first" : placeholder}
          disabled={disabled}
          className="input-field h-10 w-full rounded-lg px-4 pr-8 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-on-surface-muted hover:text-on-surface"
            tabIndex={-1}
          >
            x
          </button>
        )}
      </div>

      {isOpen && !disabled && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg card shadow-lg"
        >
          {filtered.map((opt, i) => {
            const showSection =
              !query &&
              opt.section !== undefined &&
              opt.section !== filtered[i - 1]?.section;
            return (
              <div key={opt.value + i}>
                {showSection && (
                  <div className="sticky top-0 z-10 bg-surface-low px-4 py-1 font-display text-[0.55rem] font-medium uppercase tracking-wider text-on-surface-muted">
                    {opt.section}
                  </div>
                )}
                <button
                  type="button"
                  data-option
                  onClick={() => handleSelect(opt)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left transition-colors ${
                    i === highlightIndex
                      ? "bg-surface-mid"
                      : "hover:bg-surface-mid"
                  }`}
                >
                  <span className="font-body text-sm text-on-surface">
                    {opt.label}
                  </span>
                  {opt.sublabel && (
                    <span className="ml-2 font-display text-[0.6rem] uppercase text-on-surface-muted">
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isOpen && !disabled && query && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg card shadow-lg px-4 py-3">
          <span className="font-body text-sm text-on-surface-muted">No matches</span>
        </div>
      )}
    </div>
  );
}
