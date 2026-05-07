/**
 * Centralized error-to-copy mapping. Every catch handler in the app should
 * pipe its error through `friendlyError()` so the user sees consistent
 * language instead of raw fetch / API messages.
 *
 * Inspired by the existing pattern in pokemon/[id]/page.tsx where 404/5xx
 * cases are special-cased inline; this lifts that pattern into a single
 * place so the UI never leaks "Failed to fetch" or stack traces.
 */

export interface FriendlyError {
  title: string;
  message: string;
  isAuthRequired?: boolean;
}

const NETWORK_PATTERNS = [
  "failed to fetch",
  "network",
  "load failed",
  "networkerror",
];

export function friendlyError(err: unknown): FriendlyError {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const lower = raw.toLowerCase();

  // Auth: 401 or explicit auth/sign-in language
  if (/\b401\b/.test(raw) || /not authenticated|unauthor/i.test(raw)) {
    return {
      title: "Sign-in required",
      message: "Please sign in to continue.",
      isAuthRequired: true,
    };
  }

  // Forbidden: 403
  if (/\b403\b/.test(raw) || /forbidden/i.test(raw)) {
    return {
      title: "Not allowed",
      message: "Your account doesn't have access to this resource.",
    };
  }

  // Not found: 404
  if (/\b404\b/.test(raw) || /not found/i.test(raw)) {
    return {
      title: "Not found",
      message: "We couldn't find what you were looking for.",
    };
  }

  // Rate limit: 429
  if (/\b429\b/.test(raw) || /rate limit|too many/i.test(raw)) {
    return {
      title: "Slow down",
      message:
        "You've hit the rate limit. Please wait a moment and try again.",
    };
  }

  // Stale data gate (Phase F): 503 with stale_data marker
  if (/stale[_ ]data/i.test(raw) || /\b503\b/.test(raw)) {
    return {
      title: "Meta data is stale",
      message:
        "Usage data hasn't refreshed recently. Try again later or contact the admin.",
    };
  }

  // Server: 5xx
  if (/\b5\d\d\b/.test(raw)) {
    return {
      title: "Server error",
      message: "Something broke on our end. Try again in a moment.",
    };
  }

  // Network / offline
  if (NETWORK_PATTERNS.some((p) => lower.includes(p))) {
    return {
      title: "Connection problem",
      message:
        "We couldn't reach the server. Check your connection and try again.",
    };
  }

  // Fallback: show the raw message if it's short enough to be useful,
  // otherwise a generic line. Never surface stack traces.
  if (raw && raw.length < 200) {
    return {
      title: "Something went wrong",
      message: raw,
    };
  }
  return {
    title: "Something went wrong",
    message: "Please try again.",
  };
}
