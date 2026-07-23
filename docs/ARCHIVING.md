# Archiving a record

How to turn a Wolf record into an archive that survives the app, the repo, and the decades. This is the manual procedure behind docs/DURABILITY.md; a one-tap "Export archive kit" may automate it later, but nothing here requires it.

## The archive kit

One folder (or zip) per record, containing:

| File | Source | Why it's in the kit |
| --- | --- | --- |
| `<name>.wolfrecord.json` | Export and data screen → full Wolf record bundle, with **revision history** and (your choice) **drafts** included | The lossless record. Self-contained: questions, answers, history, provenance. |
| `<name>.md` | Export → Markdown, with revision history | Human-readable, structure preserved. |
| `<name>.txt` | Export → plain text | The bottom layer. Readable by eye on anything, forever. |
| `BUNDLE_FORMAT.md` | This repository, `docs/BUNDLE_FORMAT.md` | Lets a stranger with no software rebuild a reader from the JSON. |
| `WHAT_THIS_IS.txt` | You write it, a few sentences | Who the subject is, what span of life or work the record covers, who the custodian is, and one instruction: *"the .txt file is readable as-is; everything else is redundancy."* |

Optional but recommended once capture is complete: a printed copy (or PDF/A) of the plain-text export. Paper is the only layer with a proven multi-century track record.

## Copies

Follow 3-2-1: at least **3** copies of the kit, on **2** different kinds of storage, **1** of them offsite.

A reasonable civilian version: one copy on the subject's device, one in a cloud drive (Google Drive, Dropbox — the kit is just files; upload the folder), one on a USB drive or second machine in another building. A cloud account counts as offsite; it does not count as permanent — accounts lapse with their owners.

## The verification ritual

Every few years (five is fine), whoever holds the kit:

1. **Open the `.txt` and read a page.** If that works, the record survives whatever else has rotted.
2. **Parse the `.wolfrecord.json`** with any contemporary tool and confirm it loads.
3. **If a Wolf installation still runs**, import the bundle and re-export — a full round-trip check.
4. **Copy the kit forward onto current media.** Consumer drives and flash degrade on 5–10 year scales; the refresh matters more than the check.

## Rules

- Export **with revision history**. The history is the record's honesty; an export without it is a summary.
- The disclaimer travels with the data. If a record is fictional or synthetic (see `examples/`), its subject metadata must say so — never strip it.
- Never edit an archived bundle's testimony, timestamps, or revision chains — not to fix typos, not to modernize, not to summarize. Wrap, cite, derive; the source is immutable.
- Hand custody over explicitly. An archive nobody knows they're responsible for is an orphaned artifact with extra steps.
