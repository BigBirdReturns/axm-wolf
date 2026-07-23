# Privacy

This describes what AXM Wolf stores, where it stores it, and what (if anything) leaves your device. It follows DESIGN.md Part 12.

## Local-first

- All responses, drafts, records, and installed packs are stored in this browser profile on this device, in an IndexedDB database named `AXMWolf`.
- Clearing your browser's site data (or using a private/incognito session that discards storage on close) removes the local record. Browsers may also evict a site's stored data on their own under storage pressure, without asking.
- Once a record exists, Wolf asks the browser for persistent storage (`navigator.storage.persist()`), which exempts the data from automatic eviction where the browser grants it. The Export and data screen shows whether the grant was given. A denial is not an error — it means exports matter more.
- Exporting a record is the backup and transfer mechanism. Nothing is automatically backed up elsewhere. See [ARCHIVING.md](ARCHIVING.md) for turning exports into a durable archive.
- No server receives your testimony in v0.1. There is no account, no analytics, and no backend.

## What's stored, and where

The `AXMWolf` IndexedDB database has these object stores:

| Store | Contents |
| --- | --- |
| `packs` | Installed capture packs, with trust level and install timestamp |
| `records` | Record metadata, subject info, status, and the pack snapshot used by that record |
| `responses` | Committed response revisions, keyed by record and prompt |
| `drafts` | Uncommitted draft text, keyed by record and prompt |
| `settings` | Application settings |
| `migrations` | Record of completed legacy-data migrations |

Pack snapshots travel with each record, so a record remains readable even if the originating pack is later removed or updated.

## What leaves the device

Nothing, with one exception: **if you use voice input**, the browser's built-in speech recognition runs the transcription. Depending on the browser, this may use a browser-vendor cloud service and may require a network connection. Wolf only ever stores the resulting text (as a `speech_transcript` or `mixed` revision) after you choose to commit it — never audio, and never automatically.

- If speech recognition is unsupported, the control is hidden or disabled.
- Wolf never claims voice transcription works offline.
- No analytics, telemetry, remote fonts, or other runtime network requests are made by the core app.

## Export as backup

Use the Export and data screen to download:

- a full Wolf record bundle (`.wolfrecord.json`) — record metadata, the pack snapshot, and all committed response revisions (and drafts, if you choose "include drafts")
- a Markdown (`.md`) or plain-text (`.txt`) rendering for reading or sharing

The full bundle is the only complete backup and the only supported way to move a record to another browser, device, or installation. Importing a previously exported bundle restores it; if a record with the same ID already exists locally, you are asked to replace it, import it as a copy, or cancel — nothing is overwritten silently.

## Deletion

Deleting a record from the Export and data screen requires:

1. typing the record's exact title to confirm,
2. a reminder that export is the only backup, and
3. an explicit, irreversible confirmation.

Deleting an installed pack does not delete records created from it — each record carries its own pack snapshot and remains readable.

## No accounts, no analytics, no backend

AXM Wolf v0.1 has no user accounts, no collaborative editing, no multi-device sync, and no hosted backend or API. Everything described above happens in your browser.
