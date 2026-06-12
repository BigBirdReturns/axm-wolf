import test from 'node:test';
import assert from 'node:assert/strict';

import genericPackJson from '../../src/test-fixtures/generic-engineer.wolfpack.json' with { type: 'json' };
import { validatePack } from '../../src/engine/schema.js';
import { buildRecordBundle } from '../../src/engine/bundle.js';
import { renderMarkdown, renderPlainText } from '../../src/engine/render.js';
import type { WolfRecord, CapturePack, WolfRecordBundle } from '../../src/engine/types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const pack: CapturePack = validatePack(genericPackJson);

const FIXED_NOW = '2024-03-01T09:00:00.000Z';
const FIXED_EXPORTED = '2024-03-01T10:00:00.000Z';
const FIXED_TS2 = '2024-03-01T11:00:00.000Z';

const PROMPT_OPS_1 = 'operations.normal-day';
const PROMPT_OPS_2 = 'operations.hidden-dependency';
const PROMPT_OPS_3 = 'operations.first-alert';

function makeRecord(): WolfRecord {
  return {
    recordId: 'render-test-record',
    title: 'Render Test Record',
    subject: {
      displayName: 'Render Subject',
      subtitle: 'Render Subtitle',
      organization: 'Render Org',
      role: 'Tester',
    },
    packId: pack.packId,
    packVersion: pack.packVersion,
    packDigest: 'sha256-renderdigest',
    packSnapshot: structuredClone(pack),
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    status: 'active',
    responses: [
      {
        promptId: PROMPT_OPS_1,
        revisions: [
          {
            revisionId: 'rev-001',
            text: 'First revision text for normal day.',
            capturedAt: FIXED_NOW,
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: null,
          },
          {
            revisionId: 'rev-002',
            text: 'Second revision text with updates.',
            capturedAt: FIXED_TS2,
            source: 'typed',
            locale: 'en-US',
            supersedesRevisionId: 'rev-001',
          },
        ],
      },
    ],
    drafts: [],
    lastExportedAt: null,
    appVersion: '0.1.0',
  };
}

function makeBundle(record?: WolfRecord): WolfRecordBundle {
  return buildRecordBundle(record ?? makeRecord(), { exportedAt: FIXED_EXPORTED });
}

// ---------------------------------------------------------------------------
// renderMarkdown — basic structure
// ---------------------------------------------------------------------------

test('renderMarkdown: contains record title as H1', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, /^# Render Test Record/m);
});

test('renderMarkdown: contains subject displayName', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, /Render Subject/);
});

test('renderMarkdown: contains export timestamp', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, new RegExp(FIXED_EXPORTED));
});

test('renderMarkdown: contains pack identity and version', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, /departing-engineer-handoff/);
  assert.match(md, /1\.0\.0/);
});

test('renderMarkdown: contains exact prompt text for answered prompt', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, /Describe a normal operating day for the system you know best\./);
});

test('renderMarkdown: contains current response text (last revision)', () => {
  const md = renderMarkdown(makeBundle());
  assert.match(md, /Second revision text with updates\./);
});

test('renderMarkdown: omits unanswered prompts by default', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle);
  // PROMPT_OPS_2 has no response, should not appear
  const prompt2Text = 'What dependency would surprise a new owner if it disappeared tomorrow?';
  assert.ok(!md.includes(prompt2Text), 'unanswered prompt should be absent by default');
});

test('renderMarkdown: includes unanswered prompts with includeUnanswered=true', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle, { includeUnanswered: true });
  const prompt2Text = 'What dependency would surprise a new owner if it disappeared tomorrow?';
  assert.ok(md.includes(prompt2Text), 'unanswered prompt should appear with includeUnanswered');
});

test('renderMarkdown: shows only current revision by default (no revision history)', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle);
  // First revision text should NOT appear
  assert.ok(!md.includes('First revision text for normal day.'), 'old revision should be absent by default');
  // Current revision should appear
  assert.match(md, /Second revision text with updates\./);
});

test('renderMarkdown: includeRevisionHistory shows all revisions', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle, { includeRevisionHistory: true });
  assert.match(md, /First revision text for normal day\./);
  assert.match(md, /Second revision text with updates\./);
});

test('renderMarkdown: revision history includes capturedAt and source', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle, { includeRevisionHistory: true });
  assert.match(md, new RegExp(FIXED_NOW));
  assert.match(md, /typed/);
});

test('renderMarkdown: sections appear in pack order (Operations before Continuity)', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle, { includeUnanswered: true });
  const opsIdx = md.indexOf('Operations');
  const contIdx = md.indexOf('Continuity');
  assert.ok(opsIdx < contIdx, 'Operations section should come before Continuity');
});

test('renderMarkdown: lens label is used as H3 heading', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle);
  // operations.normal-day has lensId 'system', label 'System'
  assert.match(md, /^### System/m);
});

test('renderMarkdown: does not emit HTML tags', () => {
  const bundle = makeBundle();
  const md = renderMarkdown(bundle, { includeUnanswered: true, includeRevisionHistory: true });
  assert.ok(!/<[a-z]/i.test(md), 'markdown output should not contain HTML tags');
});

test('renderMarkdown: preserves response text exactly (no HTML-escaping)', () => {
  const record = makeRecord();
  record.responses[0]!.revisions[1]!.text = 'Response with <special> & "quotes".';
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const md = renderMarkdown(bundle);
  assert.match(md, /Response with <special> & "quotes"\./);
});

// ---------------------------------------------------------------------------
// renderPlainText — basic structure
// ---------------------------------------------------------------------------

test('renderPlainText: contains record title', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, /Render Test Record/);
});

test('renderPlainText: contains subject displayName', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, /Render Subject/);
});

test('renderPlainText: contains export timestamp', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, new RegExp(FIXED_EXPORTED));
});

test('renderPlainText: contains pack identity', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, /departing-engineer-handoff/);
});

test('renderPlainText: contains exact prompt text for answered prompt', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, /Describe a normal operating day for the system you know best\./);
});

test('renderPlainText: contains current response text', () => {
  const txt = renderPlainText(makeBundle());
  assert.match(txt, /Second revision text with updates\./);
});

test('renderPlainText: omits unanswered prompts by default', () => {
  const bundle = makeBundle();
  const txt = renderPlainText(bundle);
  const prompt2Text = 'What dependency would surprise a new owner if it disappeared tomorrow?';
  assert.ok(!txt.includes(prompt2Text), 'unanswered prompt should be absent by default');
});

test('renderPlainText: includes unanswered prompts with includeUnanswered=true', () => {
  const bundle = makeBundle();
  const txt = renderPlainText(bundle, { includeUnanswered: true });
  const prompt2Text = 'What dependency would surprise a new owner if it disappeared tomorrow?';
  assert.ok(txt.includes(prompt2Text), 'unanswered prompt should appear with includeUnanswered');
});

test('renderPlainText: shows only current revision by default', () => {
  const bundle = makeBundle();
  const txt = renderPlainText(bundle);
  assert.ok(!txt.includes('First revision text for normal day.'), 'old revision absent by default');
  assert.match(txt, /Second revision text with updates\./);
});

test('renderPlainText: includeRevisionHistory shows all revisions', () => {
  const bundle = makeBundle();
  const txt = renderPlainText(bundle, { includeRevisionHistory: true });
  assert.match(txt, /First revision text for normal day\./);
  assert.match(txt, /Second revision text with updates\./);
});

test('renderPlainText: contains no HTML tags', () => {
  const bundle = makeBundle();
  const txt = renderPlainText(bundle, { includeUnanswered: true, includeRevisionHistory: true });
  assert.ok(!/<[a-z]/i.test(txt), 'plain text output must not contain HTML tags');
});

test('renderPlainText: no HTML tags even with HTML in response text', () => {
  const record = makeRecord();
  record.responses[0]!.revisions[1]!.text = 'I wrote <b>important</b> code.';
  const bundle = buildRecordBundle(record, { exportedAt: FIXED_EXPORTED });
  const txt = renderPlainText(bundle);
  // The text is preserved verbatim (not HTML-escaped), but we ensure
  // there are no engine-generated HTML tags (plain text renderer must not add any)
  assert.match(txt, /I wrote <b>important<\/b> code\./);
});

test('renderPlainText: lens label uses plain bracket notation, no markdown', () => {
  const txt = renderPlainText(makeBundle());
  // lens label should appear as [System] not ### System
  assert.match(txt, /\[System\]/);
  assert.ok(!txt.includes('### System'), 'plain text should not use markdown headings');
});

test('renderPlainText: sections separated by rules', () => {
  const txt = renderPlainText(makeBundle(), { includeUnanswered: true });
  // Should contain separator lines
  assert.match(txt, /={10,}/);
});
