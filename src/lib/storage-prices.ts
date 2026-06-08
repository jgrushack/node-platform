// Per-item pricing for the 2026 storage survey (annual, in cents).
//
// This lives in a plain module — NOT in the "use server" actions file — so
// client components can import the real values. A "use server" file only
// exposes its async exports to the client, so a const imported from it is
// `undefined` at runtime (which rendered "$NaN").
export const STORAGE_PRICES_CENTS = {
  bike: 10000,
  bin: 7500,
  ac: 15000,
  shiftpod: 10000,
} as const;
