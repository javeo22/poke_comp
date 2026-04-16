"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ProfileData } from "@/types/profile";

function getTrainerTitle(matchesPlayed: number): string {
  if (matchesPlayed >= 100) return "Champion Trainer";
  if (matchesPlayed >= 50) return "Expert Trainer";
  if (matchesPlayed >= 10) return "Skilled Trainer";
  if (matchesPlayed >= 1) return "Novice Trainer";
  return "Rookie Trainer";
}

interface TrainerCardProps {
  profile: ProfileData;
  email: string | null;
  memberSince: string;
  matchesPlayed: number;
  onUpdateDisplayName: (name: string) => Promise<void>;
  onUpdateUsername: (username: string) => Promise<void>;
  onOpenAvatarPicker: () => void;
}

export function TrainerCard({
  profile,
  email,
  memberSince,
  matchesPlayed,
  onUpdateDisplayName,
  onUpdateUsername,
  onOpenAvatarPicker,
}: TrainerCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile.display_name || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState(profile.username || "");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);

  // Sync when profile changes externally
  useEffect(() => {
    setNameValue(profile.display_name || "");
  }, [profile.display_name]);

  useEffect(() => {
    setUsernameValue(profile.username || "");
  }, [profile.username]);

  useEffect(() => {
    if (isEditingUsername && usernameRef.current) {
      usernameRef.current.focus();
      usernameRef.current.select();
    }
  }, [isEditingUsername]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const displayName = profile.display_name || email?.split("@")[0] || "Trainer";
  const title = getTrainerTitle(matchesPlayed);
  const formattedDate = new Date(memberSince).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    // Don't save if unchanged or empty (clearing sets to null via empty string)
    if (trimmed === (profile.display_name || "")) {
      setIsEditingName(false);
      return;
    }

    setSaving(true);
    try {
      await onUpdateDisplayName(trimmed || "");
    } finally {
      setSaving(false);
      setIsEditingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setNameValue(profile.display_name || "");
      setIsEditingName(false);
    }
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameValue.trim().toLowerCase();
    if (trimmed === (profile.username || "")) {
      setIsEditingUsername(false);
      setUsernameError("");
      return;
    }
    if (trimmed && !/^[a-z0-9_-]{3,20}$/.test(trimmed)) {
      setUsernameError("3-20 chars: a-z, 0-9, hyphens, underscores");
      return;
    }
    setUsernameSaving(true);
    setUsernameError("");
    try {
      await onUpdateUsername(trimmed);
      setIsEditingUsername(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setUsernameError(msg.includes("409") ? "Username taken" : msg);
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveUsername();
    else if (e.key === "Escape") {
      setUsernameValue(profile.username || "");
      setIsEditingUsername(false);
      setUsernameError("");
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <button
          onClick={onOpenAvatarPicker}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-lowest transition-colors hover:border-primary/50"
          title="Change avatar"
        >
          {profile.avatar_sprite_url ? (
            <Image
              src={profile.avatar_sprite_url}
              alt="Avatar"
              width={56}
              height={56}
              className="image-rendering-pixelated"
              unoptimized
            />
          ) : (
            <span className="font-display text-2xl text-on-surface-muted">
              {displayName[0]?.toUpperCase()}
            </span>
          )}
          {/* Hover overlay */}
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 font-display text-[0.5rem] uppercase tracking-wider text-on-surface opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </span>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Display name */}
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              maxLength={30}
              className={`input-field w-full max-w-[220px] font-display text-lg font-bold tracking-tight ${
                saving ? "opacity-50" : ""
              }`}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-2 text-left"
              title="Click to edit display name"
            >
              <span className="font-display text-lg font-bold tracking-tight text-on-surface">
                {displayName}
              </span>
              <svg
                className="h-3.5 w-3.5 text-on-surface-muted opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                />
              </svg>
            </button>
          )}

          {/* Title */}
          <p className="mt-0.5 font-display text-xs uppercase tracking-wider text-primary">
            {title}
          </p>

          {/* Member since */}
          <p className="mt-2 font-body text-xs text-on-surface-muted">
            Member since {formattedDate}
          </p>

          {/* Username */}
          <div className="mt-3 border-t border-outline-variant pt-3">
            <p className="mb-1 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
              Public Username
            </p>
            {isEditingUsername ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-on-surface-muted">@</span>
                  <input
                    ref={usernameRef}
                    type="text"
                    value={usernameValue}
                    onChange={(e) =>
                      setUsernameValue(e.target.value.toLowerCase())
                    }
                    onBlur={handleSaveUsername}
                    onKeyDown={handleUsernameKeyDown}
                    maxLength={20}
                    placeholder="choose_username"
                    className={`input-field w-full max-w-[180px] text-sm ${
                      usernameSaving ? "opacity-50" : ""
                    }`}
                  />
                </div>
                {usernameError && (
                  <p className="mt-1 text-xs text-error">{usernameError}</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsEditingUsername(true)}
                className="group flex items-center gap-1.5 text-left"
                title="Set your public username"
              >
                <span className="text-sm text-on-surface">
                  {profile.username ? `@${profile.username}` : "Set username"}
                </span>
                <svg
                  className="h-3 w-3 text-on-surface-muted opacity-0 transition-opacity group-hover:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                  />
                </svg>
              </button>
            )}
            {profile.username && !isEditingUsername && (
              <p className="mt-1 text-[0.65rem] text-on-surface-muted">
                pokecomp.app/u/{profile.username}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
