// Small typed IndexedDB adapter (DESIGN.md 8.1, 9.2: "a small typed adapter").
//
// This module is intentionally generic: it stores unknown-shaped values keyed
// by IndexedDB key paths. Typed repositories built on top of `WolfDb` are
// responsible for the shape of records, responses, drafts, packs, settings,
// migrations, operational cases, assets, observations, and evidence artifacts.
//
// Only standard IndexedDB APIs are used (indexedDB, IDBDatabase,
// IDBTransaction, IDBObjectStore, IDBRequest, ...) so this code runs unchanged
// in browsers. Tests inject an `IDBFactory` from `fake-indexeddb` to provide
// the API under Node.

export const DB_NAME = 'AXMWolf';
export const DB_VERSION = 5;

export type StoreName =
  | 'packs'
  | 'records'
  | 'responses'
  | 'drafts'
  | 'settings'
  | 'migrations'
  | 'opsCases'
  | 'opsAssets'
  | 'opsObservations'
  | 'opsEvidence'
  | 'opsWorkOrders'
  | 'opsSubmissions'
  | 'opsAnalysisReturns'
  | 'surveyAssignments';

export const STORE_NAMES: StoreName[] = [
  'packs',
  'records',
  'responses',
  'drafts',
  'settings',
  'migrations',
  'opsCases',
  'opsAssets',
  'opsObservations',
  'opsEvidence',
  'opsWorkOrders',
  'opsSubmissions',
  'opsAnalysisReturns',
  'surveyAssignments',
];

export type IDBTransactionMode = 'readonly' | 'readwrite';

/**
 * Wraps an IDBRequest in a promise that resolves with the request's result on
 * success and rejects with the request's error on failure.
 */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Typed helpers bound to an open IDBTransaction.
 *
 * IMPORTANT (transaction lifetime hazard): per the IndexedDB spec, a
 * transaction auto-commits once it has no pending requests and the current
 * task (and any microtasks queued from its event handlers) finishes without
 * issuing a new request. The standard "promise wrapper" pattern used here
 * keeps the transaction alive correctly: each call below issues a new
 * IDBRequest synchronously, and as long as callers chain subsequent
 * operations from the `onsuccess` handler's continuation (i.e. by awaiting
 * one WolfTx call before issuing the next, inside the same `transaction()`
 * callback), the transaction remains active because a new request is always
 * outstanding before the previous one's completion microtask drains. Do not
 * `await` unrelated promises (timers, fetch, other transactions) between
 * WolfTx calls inside a transaction callback -- doing so risks the
 * transaction auto-committing before your next request is issued.
 */
export class WolfTx {
  constructor(private readonly tx: IDBTransaction) {}

  private store(name: StoreName): IDBObjectStore {
    return this.tx.objectStore(name);
  }

  get<T>(store: StoreName, key: IDBValidKey | IDBValidKey[]): Promise<T | undefined> {
    return requestToPromise(this.store(store).get(key)) as Promise<T | undefined>;
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return requestToPromise(this.store(store).getAll()) as Promise<T[]>;
  }

  put<T>(store: StoreName, value: T): Promise<void> {
    return requestToPromise(this.store(store).put(value)).then(() => undefined);
  }

  delete(store: StoreName, key: IDBValidKey | IDBValidKey[]): Promise<void> {
    return requestToPromise(this.store(store).delete(key)).then(() => undefined);
  }
}

/**
 * Thin promise-based wrapper around an IDBDatabase connection.
 */
export class WolfDb {
  constructor(private readonly db: IDBDatabase) {}

  private store(name: StoreName, mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(name, mode).objectStore(name);
  }

  get<T>(store: StoreName, key: IDBValidKey | IDBValidKey[]): Promise<T | undefined> {
    return requestToPromise(this.store(store, 'readonly').get(key)) as Promise<T | undefined>;
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return requestToPromise(this.store(store, 'readonly').getAll()) as Promise<T[]>;
  }

  put<T>(store: StoreName, value: T): Promise<void> {
    return requestToPromise(this.store(store, 'readwrite').put(value)).then(() => undefined);
  }

  delete(store: StoreName, key: IDBValidKey | IDBValidKey[]): Promise<void> {
    return requestToPromise(this.store(store, 'readwrite').delete(key)).then(() => undefined);
  }

  /**
   * Runs `fn` against a single IDBTransaction spanning `storeNames`.
   *
   * The returned promise resolves once the transaction's `complete` event
   * fires (i.e. all operations performed inside `fn` were committed), and
   * rejects if `fn` throws (the transaction is aborted, rolling back any
   * writes already issued within it) or if the transaction itself reports an
   * error/abort for any other reason.
   */
  transaction(storeNames: StoreName[], mode: IDBTransactionMode, fn: (tx: WolfTx) => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const idbTx = this.db.transaction(storeNames, mode);
      let settled = false;

      idbTx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      idbTx.onerror = () => {
        if (!settled) {
          settled = true;
          reject(idbTx.error ?? new Error('IndexedDB transaction failed'));
        }
      };
      idbTx.onabort = () => {
        if (!settled) {
          settled = true;
          reject(idbTx.error ?? new Error('IndexedDB transaction aborted'));
        }
      };

      const wolfTx = new WolfTx(idbTx);

      // Run fn synchronously-first so its first request is issued before
      // this task ends, keeping the transaction alive. If fn rejects/throws,
      // abort the transaction explicitly so writes already issued roll back.
      Promise.resolve()
        .then(() => fn(wolfTx))
        .catch((err) => {
          if (!settled) {
            settled = true;
            try {
              idbTx.abort();
            } catch {
              // Transaction may already be finishing; ignore.
            }
            reject(err);
          }
        });
    });
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Opens (and if necessary creates/upgrades) the AXMWolf database.
 *
 * @param factory IDBFactory to use. Defaults to `globalThis.indexedDB`
 *   (the browser implementation). Tests pass a fresh `fake-indexeddb`
 *   `IDBFactory` instance for isolation.
 */
export function openWolfDb(factory?: IDBFactory): Promise<WolfDb> {
  const idbFactory = factory ?? globalThis.indexedDB;
  if (!idbFactory) {
    throw new Error('No IDBFactory available: pass one explicitly or run in an environment with indexedDB.');
  }

  return new Promise((resolve, reject) => {
    const request = idbFactory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('packs')) {
        const packs = db.createObjectStore('packs', { keyPath: 'packId' });
        packs.createIndex('byTrust', 'trust');
        packs.createIndex('byInstalledAt', 'installedAt');
      }

      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'recordId' });
        records.createIndex('byPackId', 'packId');
        records.createIndex('byStatus', 'status');
        records.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('responses')) {
        const responses = db.createObjectStore('responses', { keyPath: ['recordId', 'promptId'] });
        responses.createIndex('byRecordId', 'recordId');
        responses.createIndex('byPromptId', 'promptId');
        responses.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('drafts')) {
        const drafts = db.createObjectStore('drafts', { keyPath: ['recordId', 'promptId'] });
        drafts.createIndex('byRecordId', 'recordId');
        drafts.createIndex('byPromptId', 'promptId');
        drafts.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('migrations')) {
        const migrations = db.createObjectStore('migrations', { keyPath: 'id' });
        migrations.createIndex('byCompletedAt', 'completedAt');
      }

      if (!db.objectStoreNames.contains('opsCases')) {
        const opsCases = db.createObjectStore('opsCases', { keyPath: 'caseId' });
        opsCases.createIndex('byPlaybookId', 'playbookId');
        opsCases.createIndex('byAssetId', 'assetId');
        opsCases.createIndex('byStatus', 'status');
        opsCases.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('opsAssets')) {
        const opsAssets = db.createObjectStore('opsAssets', { keyPath: 'assetId' });
        opsAssets.createIndex('byCategory', 'category');
        opsAssets.createIndex('bySiteLabel', 'siteLabel');
        opsAssets.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('opsObservations')) {
        const opsObservations = db.createObjectStore('opsObservations', { keyPath: 'observationId' });
        opsObservations.createIndex('byCaseId', 'caseId');
        opsObservations.createIndex('byAssetId', 'assetId');
        opsObservations.createIndex('bySourceClass', 'sourceClass');
        opsObservations.createIndex('byObservedAt', 'observedAt');
      }

      if (!db.objectStoreNames.contains('opsEvidence')) {
        const opsEvidence = db.createObjectStore('opsEvidence', { keyPath: 'artifactId' });
        opsEvidence.createIndex('byCaseId', 'caseId');
        opsEvidence.createIndex('byRequestId', 'requestId');
        opsEvidence.createIndex('byCapturedAt', 'capturedAt');
      }

      if (!db.objectStoreNames.contains('opsWorkOrders')) {
        const workOrders = db.createObjectStore('opsWorkOrders', { keyPath: 'workOrderId' });
        workOrders.createIndex('byCaseId', 'caseId');
        workOrders.createIndex('byAssetId', 'assetId');
        workOrders.createIndex('byIssueCode', 'issueCode');
        workOrders.createIndex('byStatus', 'status');
        workOrders.createIndex('byUpdatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains('opsSubmissions')) {
        const submissions = db.createObjectStore('opsSubmissions', { keyPath: 'submissionId' });
        submissions.createIndex('byCaseId', 'caseId');
        submissions.createIndex('byCreatedAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('opsAnalysisReturns')) {
        const returns = db.createObjectStore('opsAnalysisReturns', { keyPath: 'responseId' });
        returns.createIndex('bySubmissionId', 'submissionId');
        returns.createIndex('byCaseId', 'caseId');
        returns.createIndex('byImportedAt', 'importedAt');
      }

      if (!db.objectStoreNames.contains('surveyAssignments')) {
        const assignments = db.createObjectStore('surveyAssignments', { keyPath: 'assignmentId' });
        assignments.createIndex('byPackId', 'packId');
        assignments.createIndex('byStatus', 'status');
        assignments.createIndex('byUpdatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => resolve(new WolfDb(request.result));
    request.onerror = () => reject(request.error ?? new Error('Failed to open AXMWolf database'));
  });
}
