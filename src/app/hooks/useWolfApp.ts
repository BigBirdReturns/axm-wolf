import { useEffect, useState } from 'react';
import {
  openWolfDb,
  listRecords,
  saveRecord,
  type WolfDb,
} from '../../storage/index.js';
import {
  validatePack,
  digestPack,
  createRecord,
  type CapturePack,
  type PackTrust,
} from '../../engine/index.js';
import type { LegacyMigrationSummary } from '../../storage/index.js';
import wolfsDepositionPackJson from '../../packs/wolfs-deposition/wolfs-deposition.wolfpack.json' with { type: 'json' };
import { runLegacyMigrationIfNeeded } from '../lib/legacyMigrationRunner.js';
import { APP_VERSION } from '../config.js';

/**
 * A row in the 'packs' object store. Not exported from src/storage (no
 * dedicated pack repository exists yet), so the app defines the shape it
 * persists. Kept intentionally small and content-free.
 */
export type StoredPack = {
  packId: string;
  packVersion: string;
  digest: string;
  trust: PackTrust;
  installedAt: string;
  pack: CapturePack;
};

export type RecordSummary = {
  recordId: string;
  title: string;
  status: 'active' | 'completed' | 'archived';
  updatedAt: string;
  packId: string;
};

export type WolfAppState = {
  db: WolfDb | null;
  packs: StoredPack[];
  records: RecordSummary[];
  loading: boolean;
  error: string | null;
  /** Re-reads the records list from storage (e.g. after creating one). */
  refreshRecords: () => Promise<void>;
  /**
   * Result of the one-time legacy database migration (DESIGN.md 8.4), if it
   * ran during this bootstrap and migrated at least one answer or recorded a
   * recovery report entry. `null` if no migration happened (already
   * complete, nothing to migrate, or indexedDB unavailable).
   */
  migrationSummary: LegacyMigrationSummary | null;
};

const BUNDLED_PACK = wolfsDepositionPackJson as unknown;

/**
 * On first load: opens the database, validates and installs the bundled
 * pack (The Wolf's Deposition) if not already present, then lists installed
 * packs and records.
 */
export function useWolfApp(): WolfAppState {
  const [db, setDb] = useState<WolfDb | null>(null);
  const [packs, setPacks] = useState<StoredPack[]>([]);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationSummary, setMigrationSummary] = useState<LegacyMigrationSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const wolfDb = await openWolfDb();
        if (cancelled) return;

        const pack = validatePack(BUNDLED_PACK);
        const digest = await digestPack(pack);

        const existing = await wolfDb.get<StoredPack>('packs', pack.packId);
        if (!existing) {
          const storedPack: StoredPack = {
            packId: pack.packId,
            packVersion: pack.packVersion,
            digest,
            trust: 'bundled',
            installedAt: new Date().toISOString(),
            pack,
          };
          await wolfDb.put('packs', storedPack);
        }

        const installedPacks = await wolfDb.getAll<StoredPack>('packs');

        const migration = await runLegacyMigrationIfNeeded(wolfDb);
        if (cancelled) return;

        const recordSummaries = await listRecords(wolfDb);

        if (cancelled) return;
        setDb(wolfDb);
        setPacks(installedPacks);
        setRecords(recordSummaries);
        if (migration && (migration.migrated > 0 || migration.skippedUnknown > 0)) {
          setMigrationSummary(migration);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRecords(): Promise<void> {
    if (!db) return;
    const recordSummaries = await listRecords(db);
    setRecords(recordSummaries);
  }

  return { db, packs, records, loading, error, refreshRecords, migrationSummary };
}

/**
 * Creates a new record against the given pack, persists it, refreshes the
 * record list, and returns the new record's id.
 */
export async function createAndSaveRecord(
  db: WolfDb,
  storedPack: StoredPack,
  refreshRecords: () => Promise<void>,
): Promise<string> {
  const recordId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `record-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const record = createRecord({
    recordId,
    pack: storedPack.pack,
    packDigest: storedPack.digest,
    appVersion: APP_VERSION,
  });

  await saveRecord(db, record);
  await refreshRecords();
  return recordId;
}
