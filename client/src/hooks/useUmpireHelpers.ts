import type { PlayerSlim as Player } from "@/types";
import { BwfMatchState } from "@/types/umpire";

export function useUmpireHelpers(players: Player[], match: BwfMatchState | null) {
  const getName = (idOrName: string) =>
    players.find((p) => p.id === idOrName)?.full_name || idOrName;

  const getGender = (idOrName: string) =>
    players.find((p) => p.id === idOrName)?.gender?.toLowerCase() || "unknown";

  const getInferredCategory = (cat: string, t1: BwfMatchState["t1"], t2: BwfMatchState["t2"]): string => {
    if (match?.customCategory) return match.customCategory;
    if (!["Singles", "Doubles", "Hybrid"].includes(cat)) return cat;
    const t1p1 = players.find(p => p.id === t1.p1Id);
    const t1p2 = t1.p2Id ? players.find(p => p.id === t1.p2Id) : undefined;
    const t2p1 = players.find(p => p.id === t2.p1Id);
    const t2p2 = t2.p2Id ? players.find(p => p.id === t2.p2Id) : undefined;
    const getComp = (p1?: Player, p2?: Player) => {
      const g1 = p1?.gender === "Female" ? "F" : (p1?.gender === "Male" ? "M" : "U");
      if (!p2) return g1;
      const g2 = p2?.gender === "Female" ? "F" : (p2?.gender === "Male" ? "M" : "U");
      if (g1 === "U" || g2 === "U") return "UU";
      if (g1 === "M" && g2 === "M") return "MM";
      if (g1 === "F" && g2 === "F") return "FF";
      return "MF";
    };
    const c1 = getComp(t1p1, t1p2);
    const c2 = getComp(t2p1, t2p2);
    const formatComp = (c: string, isSingles: boolean) => {
      if (isSingles) {
        if (c === "M") return "Men's Singles";
        if (c === "F") return "Women's Singles";
        return "Singles";
      } else {
        if (c === "MM") return "Men's Doubles";
        if (c === "FF") return "Women's Doubles";
        if (c === "MF") return "Mixed Doubles";
        return "Doubles";
      }
    };
    if (cat === "Singles") {
      if (c1 === c2 && c1 !== "U") return formatComp(c1, true);
      if (c1 !== c2 && c1 !== "U" && c2 !== "U") return `${formatComp(c1, true)} vs ${formatComp(c2, true)}`;
      return "Singles";
    }
    if (cat === "Doubles") {
      if (c1 === c2 && c1 !== "UU") return formatComp(c1, false);
      if (c1 !== c2 && c1 !== "UU" && c2 !== "UU") return `${formatComp(c1, false)} vs ${formatComp(c2, false)}`;
      return "Doubles";
    }
    if (cat === "Hybrid") {
      const n1 = t1p2 ? formatComp(c1, false) : formatComp(c1, true);
      const n2 = t2p2 ? formatComp(c2, false) : formatComp(c2, true);
      return `${n1} vs ${n2}`;
    }
    return cat;
  };

  const deduceCategory = () => {
    if (!match) return "Singles";
    const t1HasP2 = !!match.t1.p2Id;
    const t2HasP2 = !!match.t2.p2Id;
    if (!t1HasP2 && !t2HasP2) {
      const g1 = getGender(match.t1.p1Id), g2 = getGender(match.t2.p1Id);
      if (g1 === "male" && g2 === "male") return "MS";
      if (g1 === "female" && g2 === "female") return "WS";
      return "Singles";
    } else if (t1HasP2 && t2HasP2) {
      const gs = [match.t1.p1Id, match.t1.p2Id!, match.t2.p1Id, match.t2.p2Id!].map(getGender);
      if (gs.every(g => g === "male")) return "MD";
      if (gs.every(g => g === "female")) return "WD";
      const t1Mixed = (gs[0] === "male") !== (gs[1] === "male");
      const t2Mixed = (gs[2] === "male") !== (gs[3] === "male");
      if (t1Mixed && t2Mixed) return "XD";
      return "Doubles";
    }
    return "Hybrid";
  };

  return { getName, getGender, getInferredCategory, deduceCategory };
}
