// Vitest setup for the component-test layer (DESIGN.md 14.1, 14.5).
//
// - fake-indexeddb/auto installs a global IndexedDB implementation so
//   components that call `openWolfDb()` (which defaults to the global
//   `indexedDB`) resolve in jsdom, mirroring tests/storage/db.test.ts's use
//   of fake-indexeddb for the node:test layer.
// - @testing-library/jest-dom adds DOM-focused matchers (toBeDisabled,
//   toBeInTheDocument, etc.) to Vitest's `expect`.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
