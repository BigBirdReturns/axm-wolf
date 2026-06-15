// Curated "Example packs" shown on the Packs screen (DESIGN.md 4.1, 4.8,
// 12.3). Each entry's `pack` is the raw imported JSON, kept as `unknown` --
// PacksScreen validates it through the same parsePackFromText path used for
// file imports before it is ever installed. Bundled at build time via a
// static JSON import (no network requests).
//
// The Wolf's Deposition is already installed as the app's default bundled
// pack (see useWolfApp.ts), so it is intentionally not duplicated here.

import contractingOfficersDepositionPackJson from '../../packs/contracting-officers-deposition/contracting-officers-deposition.wolfpack.json' with { type: 'json' };

export type ExamplePack = {
  pack: unknown;
  label: string;
  blurb: string;
};

export const EXAMPLE_PACKS: ExamplePack[] = [
  {
    pack: contractingOfficersDepositionPackJson,
    label: "The Contracting Officer's Deposition",
    blurb:
      'Thirty prompts across five sections for a departing federal contracting officer: the discretion behind the determinations, the negotiations behind the price memos, and the judgment that retires with the warrant.',
  },
];
