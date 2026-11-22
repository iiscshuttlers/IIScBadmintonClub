import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * Query-string state for a section page's tabs (Club, Players): `?tab=…`
 * plus any sub-params. Reads through the router, so in-app links, redirects
 * and Back/Forward all update it. `update` pushes an entry by default (Back
 * walks tabs, like the tournament page) and drops the old tab's #hash;
 * `replace` keeps the hash and rewrites the current entry (alias clean-up);
 * `keepHash` keeps it on a push (a sub-tab inside a #hash tab, e.g. the
 * profile's #TRAINING).
 */
export function useSectionParams(): [
  URLSearchParams,
  (changes: Record<string, string | null>, opts?: { replace?: boolean; keepHash?: boolean }) => void,
] {
  const search = useSearch();
  const [path, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const update = useCallback(
    (changes: Record<string, string | null>, opts: { replace?: boolean; keepHash?: boolean } = {}) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const q = next.toString();
      const hash = opts.replace || opts.keepHash ? window.location.hash : "";
      navigate(`${path}${q ? `?${q}` : ""}${hash}`, { replace: !!opts.replace });
    },
    [search, path, navigate],
  );

  return [params, update];
}
