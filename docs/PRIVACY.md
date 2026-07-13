# Privacy

This describes what AXM Wolf stores, where it stores it, and what leaves your device. It follows DESIGN.md Part 12 and covers both testimony records and the experimental WOLF Ops layer.

A guided recipient link does not grant the sender remote access. It selects one installed question pack and simplifies the interface. Answers still remain in the recipient's browser until the recipient taps **Send my answers** and chooses a destination through the device share sheet. If file sharing is unavailable, WOLF downloads the `.wolfrecord.json` file and explains that it must be attached manually.

Labeled dashboard invitations include an assignment ID, recipient label, and survey label in the URL. Those labels are visible to anyone who receives the link and are included in the returned record, so operators should use recognizable labels rather than secrets or unnecessary sensitive information.

The survey dashboard is local to the operator's browser profile. It does not poll recipients, detect link opens, or synchronize between operator devices. Importing a returned record is the event that marks a matching invitation received.

## Local-first

- Responses, drafts, records, installed packs, operational cases, and operational evidence are stored in this browser profile on this device, in an IndexedDB database named `AXMWolf`.
- Clearing the browser's site data, using an incognito session that discards storage, or using the in-app wipe-all action removes the corresponding local data.
- Exporting a testimony record is its backup and transfer mechanism. Nothing is automatically backed up elsewhere.
- Exporting a WOLF Ops backup is the supported way to preserve and transfer operational cases and their original media.
- No server receives testimony or operational media in this implementation. There is no account, analytics service, or application backend.

## What is stored

The `AXMWolf` IndexedDB database has these object stores:

| Store | Contents |
| --- | --- |
| `packs` | Installed capture packs, with trust level and install timestamp |
| `records` | Testimony-record metadata, subject information, status, and the pack snapshot used by that record |
| `responses` | Committed response revisions, keyed by record and prompt |
| `drafts` | Uncommitted draft text, keyed by record and prompt |
| `settings` | Application settings |
| `migrations` | Record of completed data migrations |
| `opsCases` | Guided-inspection facts, completed or deferred evidence requests, status, and local operating context |
| `opsEvidence` | Photographs, videos, documents, measurements, metadata, source class, and capture timestamp for WOLF Ops cases |
| `opsWorkOrders` | Assignment, stabilization, verification, recurrence, follow-up, and closure history |

Pack snapshots travel with each testimony record, so a record remains readable even if the originating pack is later removed or updated.

Operational media can be substantially more sensitive than a checklist. It may unintentionally reveal people, private papers, addresses, access credentials, financial information, tenant belongings, customer information, or business operations. Capture only the view requested by the playbook. Avoid unrelated faces, documents, screens, keys, labels, and possessions. Review the frame before saving it.

The current WOLF Ops interface stores the original browser `Blob` where available and creates temporary local object URLs only to preview that evidence on screen. It does not upload the media or claim that the pixels have been interpreted.

## What leaves the device

Nothing leaves the application through AXM Wolf's own runtime code, with one exception: **if you use voice input**, the browser's built-in speech recognition performs transcription. Depending on the browser, this may use a browser-vendor cloud service and may require a network connection. Wolf stores only the resulting text after you choose to commit it. It does not store an audio recording.

- If speech recognition is unsupported, the control is hidden or disabled.
- Wolf never claims voice transcription works offline.
- The core app makes no analytics, telemetry, remote-font, media-upload, inference, or other application API request.
- Selecting a photograph or video for WOLF Ops stores it locally in IndexedDB. No remote image analysis occurs in this implementation.

A later optional media interpreter would require a separate, explicit privacy contract. It must identify where processing occurs, what bytes leave the device, what is retained, and how derived claims cite the original evidence. That capability is not present here.

## Testimony export as backup

Use the Export and data screen to download:

- a full Wolf record bundle (`.wolfrecord.json`) containing record metadata, the pack snapshot, and all committed response revisions, plus drafts when explicitly included;
- a Markdown (`.md`) or plain-text (`.txt`) rendering for reading or sharing.

The full bundle is the only complete testimony backup and the supported way to move a testimony record to another browser, device, or installation. Import conflicts require an explicit replace, copy, or cancel choice. Nothing is overwritten silently.

Operational cases and evidence are not included in testimony-record exports. Use **Export Ops backup** to create a `.wolfops.json` custody package containing asset passports, inspections, observations, work orders, and embedded media bytes. Restoring one replaces WOLF Ops data only after explicit confirmation and leaves testimony records untouched. The package is not encrypted; protect it as you would the original media.

**Send for analysis** creates a frozen `.wolfhandoff.json` copy of one inspection, including its relevant media, hashes, explicit question, and a strict return template. The live inspection remains writable. The browser share sheet is used when available; otherwise WOLF downloads the file. Nothing is uploaded by WOLF itself. Handoffs are currently unencrypted and must be sent through an appropriate channel.

An imported `.wolfreturn.json` must match a submission created on the same device and may cite only evidence included in that frozen submission. It appends pending `subscription_assisted_analysis` observations without replacing current facts or later user work. The operator explicitly accepts or rejects each returned claim. Duplicate response IDs do not create duplicate residue.

## Deletion

Deleting a testimony record from the Export and data screen requires the record title and an explicit irreversible confirmation. Removing an installed pack does not delete records created from it because each record carries its own pack snapshot.

Resetting a WOLF Ops inspection deletes that local case and its linked evidence after confirmation. The Settings wipe-all action deletes packs, testimony records, responses, drafts, settings, migration rows, operational cases, and operational evidence from the browser profile after the required confirmation sequence.

## Security limits

AXM Wolf does not currently provide application-level encryption at rest. Anyone with access to the unlocked browser profile or device may be able to access local data. Do not use the current operational-media layer for identification documents, payment credentials, immigration records, medical records, entry codes, private tenant communications, or other material whose exposure would create disproportionate harm.

## No accounts, analytics, or backend

AXM Wolf v0.1 and this WOLF Ops prototype have no user accounts, collaborative editing, multi-device synchronization, hosted backend, or application inference API. The local browser profile remains the data boundary.

## Optional hosted interview mode

The Glass Onion v0.3 deployment is an explicit exception to the standalone boundary. Invitations at `/wolf/SUR##` synchronize only their assigned WOLF record to the same-origin `/wolf/api/` service and D1 database. Recipient authorization uses a random capability token placed after `#k=` in the invitation URL; the server stores only its SHA-256 hash. Operators authenticate in any modern browser using Cloudflare Access email one-time PINs. The Worker validates the signed Access JWT and then enforces D1 workspace membership for every operator read or write; there is no shared dashboard password.

Hosted capture still writes to IndexedDB first. Network failure does not erase or block local work. File export remains available as a backup. Hosted mode makes no AI calls. Analysis returns uploaded by the operator are displayed as read-only data and never overwrite the participant's answers.
