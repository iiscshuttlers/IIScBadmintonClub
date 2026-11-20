import React, { useState } from "react";
import { X, Pencil, Link, Unlink, Phone } from "lucide-react";
import { getDepartmentAcronym } from "@/data/departments";
import { entryRoundLabel } from "@/lib/bracketGenerator";
import type { Participant } from "@/types/tournament";

export interface ParticipantSeedingTableProps {
  category: string;
  parts: Participant[];
  allPlayers: any[];
  isDoubles: boolean;
  selectedParts: string[];
  toggleSelect: (id: string) => void;
  updateSeed: (id: string, seed: number) => Promise<void>;
  updateEntryRound: (id: string, round: number | null) => Promise<void>;
  removeParticipant: (id: string) => Promise<void>;
  linkParticipantToPlayer: (participantId: string, playerId: string | null, playerName: string) => Promise<void>;
  linkParticipantToPartner: (participantId: string, partnerId: string | null, partnerName: string) => Promise<void>;
  saveEditedName: (id: string, name1: string, name2: string) => Promise<void>;
  /** Omit to hide phone editing (it writes players.contact_number, which only admins can). */
  updatePhone?: (playerId: string, phone: string) => Promise<void>;
  drawPlan?: any;
  resolvedEntryRound?: Map<string, number>;
}

export function ParticipantSeedingTable({
  category,
  parts,
  allPlayers,
  isDoubles,
  selectedParts,
  toggleSelect,
  updateSeed,
  updateEntryRound,
  removeParticipant,
  linkParticipantToPlayer,
  linkParticipantToPartner,
  saveEditedName,
  updatePhone,
  drawPlan,
  resolvedEntryRound,
}: ParticipantSeedingTableProps) {
  const [editingName, setEditingName] = useState<{ id: string; name1: string; name2: string } | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSearch2, setLinkSearch2] = useState("");
  const [editingPhone, setEditingPhone] = useState<{ playerId: string; phone: string } | null>(null);

  const filteredPlayers = (search: string) => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allPlayers.filter(p =>
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.iisc_email?.toLowerCase().includes(q)
    ).slice(0, 8);
  };

  return (
    <div className="space-y-1">
      {parts.map((p, i) => {
        const player = allPlayers?.find((pl) => pl.id === p.player_id);
        const partner = allPlayers?.find((pl) => pl.id === p.partner_id);
        const effectiveRound = resolvedEntryRound?.get(p.id) ?? 1;

        let name1 = p.display_name ?? player?.full_name ?? "Unknown";
        let name2 = partner?.full_name ?? "partner";
        const dept1 = player?.department || "External/Other";
        const dept2 = partner?.department || "External/Other";

        if (isDoubles && p.display_name && p.display_name.includes("&")) {
          const names = p.display_name.split("&").map(s => s.trim());
          name1 = names[0];
          name2 = names[1];
        }

        return (
          <div key={p.id} className="flex flex-col gap-2 py-3 border-b border-border last:border-0 hover:bg-card/20 px-2 -mx-2 rounded-xl transition-colors">
            {/* Top Row */}
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 mt-1 shrink-0">
                <input
                  type="checkbox"
                  checked={selectedParts.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary cursor-pointer"
                />
                <input
                  type="number"
                  min={1}
                  value={p.seed ?? i + 1}
                  onChange={(e) => updateSeed(p.id, parseInt(e.target.value))}
                  className="w-10 sm:w-12 text-center text-sm font-black rounded-lg border border-border-strong bg-muted py-1 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                {isDoubles ? (
                  <div className="flex flex-col sm:flex-row sm:items-start w-full gap-1.5 sm:gap-3">
                    <div className="flex flex-col flex-1 min-w-0 sm:pr-3 sm:border-r border-border-strong">
                      <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{name1}</span>
                        {!p.player_id && <span className="text-[9px] font-black uppercase text-warning bg-warning/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">{getDepartmentAcronym(dept1)}</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 sm:pl-1">
                      <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{name2}</span>
                        {!p.partner_id && <span className="text-[9px] font-black uppercase text-warning bg-warning/50 px-1.5 py-0.5 rounded-full shrink-0">ext</span>}
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground truncate mt-0.5">{getDepartmentAcronym(dept2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center min-h-[32px]">
                    <div className="text-sm font-bold text-foreground truncate flex items-center gap-2">
                      <span className="truncate">{p.display_name ?? player?.full_name ?? "Unknown"}</span>
                      {!p.player_id && (
                        <span className="text-[9px] font-black uppercase text-warning bg-warning/50 px-1.5 py-0.5 rounded-full shrink-0">external</span>
                      )}
                    </div>
                    {(() => {
                      const emailDisplay = player ? (player.iisc_email || player.email) : p.email;
                      const dept = player?.department ? getDepartmentAcronym(player.department) : null;
                      const info = [dept, emailDisplay].filter(Boolean).join(" · ");
                      return info ? (
                        <div className="text-[10px] font-bold text-muted-foreground mt-0.5 truncate">{info}</div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>

              <button
                onClick={() => removeParticipant(p.id)}
                title="Remove Participant"
                className="p-1.5 mt-0.5 text-muted-foreground hover:text-danger hover:bg-danger/30 rounded-lg transition shrink-0 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Row */}
            <div className="flex flex-wrap items-center gap-2 pl-[3.25rem] sm:pl-[4.25rem]">
              {drawPlan && (
                <select
                  value={p.entry_round == null ? "" : String(p.entry_round)}
                  onChange={(e) => updateEntryRound(p.id, e.target.value === "" ? null : parseInt(e.target.value))}
                  title="Round this player plays their first match in"
                  className={`shrink-0 text-[11px] font-bold rounded-lg border py-1.5 px-2 outline-none max-w-[10rem] cursor-pointer transition-colors ${p.entry_round == null ? "border-border-strong bg-muted text-muted-foreground hover:border-border-strong/90" : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"}`}
                >
                  <option value="" className="bg-muted text-foreground">Auto — {entryRoundLabel(effectiveRound, drawPlan.drawSize)}</option>
                  {Array.from(
                    { length: Math.max(1, Math.min(drawPlan.totalRounds - 1, 4)) },
                    (_, idx) => idx + 1
                  ).map((r) => (
                    <option key={r} value={r} className="bg-muted text-foreground">
                      {entryRoundLabel(r, drawPlan.drawSize)}
                      {r > 1 ? ` (${r - 1} bye${r > 2 ? "s" : ""})` : ""}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-0.5 bg-muted/80 rounded-lg p-0.5 border border-border-strong/50">
                <button
                  onClick={() => {
                    setEditingName({ id: p.id, name1, name2 });
                    setLinkingId(null);
                  }}
                  title="Edit Names"
                  className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted-strong rounded-md transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setLinkingId(linkingId === p.id ? null : p.id); setLinkSearch(""); setEditingName(null); }}
                  title={p.player_id ? "Change linked player" : "Link to registered player"}
                  className={`p-1.5 rounded-md transition hover:bg-muted-strong ${p.player_id ? "text-info" : "text-muted-foreground hover:text-info"}`}
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
                {p.player_id && (
                  <button
                    onClick={() => linkParticipantToPlayer(p.id, null, p.display_name?.split(' &')[0] || "")}
                    title="Unlink Player 1"
                    className="p-1.5 text-warning hover:text-warning/80 hover:bg-muted-strong rounded-md transition"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                )}
                {isDoubles && p.partner_id && (
                  <button
                    onClick={() => linkParticipantToPartner(p.id, null, p.display_name?.split('&')[1]?.trim() || "")}
                    title="Unlink Player 2"
                    className="p-1.5 text-danger hover:text-danger/80 hover:bg-muted-strong rounded-md transition"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                )}
                {p.player_id && updatePhone && (
                  <button
                    onClick={() => {
                      const pl = allPlayers?.find((x: any) => x.id === p.player_id);
                      setEditingPhone(editingPhone?.playerId === p.player_id ? null : { playerId: p.player_id, phone: pl?.contact_number ?? "" });
                    }}
                    title="Set phone number"
                    className={`p-1.5 rounded-md transition hover:bg-muted-strong ${player?.contact_number ? "text-success" : "text-muted-foreground hover:text-success"}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Inline Name Editor */}
            {editingName?.id === p.id && (
              <div className="mt-2 p-3 rounded-xl bg-muted/80 border border-border-strong space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editingName.name1}
                    onChange={(e) => setEditingName(p => p ? { ...p, name1: e.target.value } : null)}
                    placeholder={isDoubles ? "Player 1 Name" : "Player Name"}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border-strong bg-card"
                  />
                  {isDoubles && (
                    <input
                      value={editingName.name2}
                      onChange={(e) => setEditingName(p => p ? { ...p, name2: e.target.value } : null)}
                      placeholder="Player 2 Name"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border-strong bg-card"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEditedName(p.id, editingName.name1, editingName.name2)}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingName(null)}
                    className="px-3 py-1 rounded-lg bg-muted-strong text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Inline Link Search */}
            {linkingId === p.id && (
              <div className="mt-2 p-3 rounded-xl bg-info/10 border border-info/40 space-y-2">
                <div className="text-xs font-bold text-info">
                  Link {name1} to registered player:
                </div>
                <input
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Search registered players by name or email..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border-strong bg-card"
                />
                {filteredPlayers(linkSearch).length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredPlayers(linkSearch).map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => {
                          linkParticipantToPlayer(p.id, pl.id, pl.full_name);
                          setLinkingId(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-info/15 flex items-center justify-between"
                      >
                        <span className="font-bold text-soft">{pl.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{pl.iisc_email || pl.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {isDoubles && (
                  <>
                    <div className="text-xs font-bold text-info pt-2 border-t border-info/15">
                      Link partner ({name2}) to registered player:
                    </div>
                    <input
                      value={linkSearch2}
                      onChange={(e) => setLinkSearch2(e.target.value)}
                      placeholder="Search partner by name or email..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-border-strong bg-card"
                    />
                    {filteredPlayers(linkSearch2).length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredPlayers(linkSearch2).map(pl => (
                          <button
                            key={pl.id}
                            onClick={() => {
                              linkParticipantToPartner(p.id, pl.id, pl.full_name);
                              setLinkingId(null);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-info/15 flex items-center justify-between"
                          >
                            <span className="font-bold text-soft">{pl.full_name}</span>
                            <span className="text-[10px] text-muted-foreground">{pl.iisc_email || pl.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button onClick={() => setLinkingId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}

            {/* Inline Phone Edit */}
            {updatePhone && editingPhone?.playerId === p.player_id && (
              <div className="mt-2 p-3 rounded-xl bg-success/10 border border-success/40 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editingPhone.phone}
                    onChange={(e) => setEditingPhone(p => p ? { ...p, phone: e.target.value } : null)}
                    placeholder="Phone number"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border-strong bg-card"
                  />
                  <button
                    onClick={() => {
                      updatePhone(editingPhone.playerId, editingPhone.phone);
                      setEditingPhone(null);
                    }}
                    className="px-3 py-1 rounded-lg bg-success text-success-foreground text-xs font-bold"
                  >
                    Save Phone
                  </button>
                  <button
                    onClick={() => setEditingPhone(null)}
                    className="px-3 py-1 rounded-lg bg-muted-strong text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
