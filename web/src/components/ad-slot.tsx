"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { EthicalAds } from "@/components/ethical-ads";
import { isAdRoute } from "@/lib/ad-routes";
import { fetchProfile } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

/**
 * Layout-level gate that renders <EthicalAds /> only when:
 *   - current pathname is in AD_ALLOWED_ROUTES, AND
 *   - user is not a Ko-fi supporter (supporters are ad-free).
 *
 * Logged-out users see ads on allowed routes. Supporter status is resolved
 * client-side once per session; a brief render-with-no-ad flash before
 * the profile resolves is acceptable.
 */
export function AdSlot() {
  const pathname = usePathname();
  const [supporter, setSupporter] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async (): Promise<boolean> => {
      const supabase = createClient();
      if (!supabase) return false;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      try {
        const fp = await fetchProfile();
        return fp.profile.supporter;
      } catch {
        return false;
      }
    };
    resolve().then((value) => {
      if (!cancelled) setSupporter(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdRoute(pathname)) return null;
  if (supporter === null) return null; // wait for resolution to avoid flash
  if (supporter) return null;
  return <EthicalAds />;
}
