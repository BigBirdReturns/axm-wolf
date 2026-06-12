// Legacy migration runner (DESIGN.md 8.4): app-layer glue that owns
// first-pack knowledge (the bundled "Wolf's Deposition" pack, its legacy
// database/store names, and the checked-in legacy id migration map) and
// invokes the pack-agnostic `migrateLegacyAnswers` storage function.

import {
  migrateLegacyAnswers,
  type WolfDb,
  type LegacyMigrationConfig,
  type LegacyMigrationSummary,
} from '../../storage/index.js';
import { validatePack, digestPack } from '../../engine/index.js';
import wolfsDepositionPackJson from '../../packs/wolfs-deposition/wolfs-deposition.wolfpack.json' with { type: 'json' };
import legacyIdMigrationMap from '../../packs/wolfs-deposition/legacy-id-migration-map.json' with { type: 'json' };
import { APP_VERSION } from '../config.js';

const LEGACY_DB_NAME = 'WolfsDeposition';
const LEGACY_STORE_NAME = 'answers';

/**
 * Runs the one-time legacy database migration (DESIGN 8.4) if it has not
 * already completed. Returns `null` when `indexedDB` is unavailable in this
 * environment (storage disabled), otherwise the migration summary (which may
 * report `migrated: 0` if there was nothing to migrate or it already ran).
 */
export async function runLegacyMigrationIfNeeded(db: WolfDb): Promise<LegacyMigrationSummary | null> {
  if (typeof globalThis.indexedDB === 'undefined') {
    return null;
  }

  const pack = validatePack(wolfsDepositionPackJson);
  const packDigest = await digestPack(pack);

  const config: LegacyMigrationConfig = {
    legacyDbName: LEGACY_DB_NAME,
    legacyStoreName: LEGACY_STORE_NAME,
    migrationMap: legacyIdMigrationMap as Record<string, string>,
    pack,
    packDigest,
    recordId: crypto.randomUUID(),
    appVersion: APP_VERSION,
  };

  return migrateLegacyAnswers(db, globalThis.indexedDB, config);
}
