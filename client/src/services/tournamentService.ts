/**
 * Tournament data access. The functions live in ./tournament/<area>.ts; this
 * barrel re-exports every name, so importers (and vi.mock of this path) are
 * unchanged.
 */
export * from "./tournament/tournaments";
export * from "./tournament/matches";
export * from "./tournament/matchWrites";
export * from "./tournament/scoring";
export * from "./tournament/roundRules";
export * from "./tournament/participants";
export * from "./tournament/registrations";
export * from "./tournament/officials";
export * from "./tournament/notices";
export * from "./tournament/engagement";
export * from "./tournament/reports";
export * from "./tournament/displays";
export * from "./tournament/realtime";
export { tournamentService } from "./tournament/serviceObject";
