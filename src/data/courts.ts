import type { Court } from "../bracket/types";

/* Real Wimbledon show courts (URS-67). Stable facts, not placeholder — capacities
   are the AELTC's own published approximate figures. Tier drives the legend pill
   tint (URS-18): "roofed" = has a retractable roof (Centre Court, No.1 Court),
   "open" = no roof. */
export const COURTS: Court[] = [
  { id: "centre", name: "Centre Court", tier: "roofed", capacity: 14979 },
  { id: "no1", name: "No.1 Court", tier: "roofed", capacity: 12345 },
  { id: "no2", name: "No.2 Court", tier: "open", capacity: 4000 },
  { id: "no3", name: "No.3 Court", tier: "open", capacity: 2000 },
  { id: "court12", name: "Court 12", tier: "open" },
  { id: "court18", name: "Court 18", tier: "open" },
];

export const COURTS_BY_ID: Record<string, Court> = Object.fromEntries(COURTS.map((c) => [c.id, c]));

export function courtName(courtId?: string): string {
  if (!courtId) return "";
  return COURTS_BY_ID[courtId]?.name ?? courtId;
}

export function courtTierClass(courtId?: string): string {
  if (!courtId) return "";
  const tier = COURTS_BY_ID[courtId]?.tier;
  return tier ? ` ${tier}` : "";
}
