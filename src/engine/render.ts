import type { WolfRecordBundle, HumanExportOptions, PromptResponse } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLensLabel(snapshot: WolfRecordBundle['pack']['snapshot'], lensId: string): string {
  const lens = snapshot.lenses.find(l => l.id === lensId);
  return lens ? lens.label : lensId;
}

function findPrompt(snapshot: WolfRecordBundle['pack']['snapshot'], promptId: string) {
  return snapshot.prompts.find(p => p.id === promptId) ?? null;
}

function getResponseForPrompt(responses: PromptResponse[], promptId: string): PromptResponse | null {
  return responses.find(r => r.promptId === promptId) ?? null;
}

function hasResponse(responses: PromptResponse[], promptId: string): boolean {
  const r = getResponseForPrompt(responses, promptId);
  return r != null && r.revisions.length > 0;
}

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

export function renderMarkdown(bundle: WolfRecordBundle, options?: HumanExportOptions): string {
  const includeUnanswered = options?.includeUnanswered ?? false;
  const includeRevisionHistory = options?.includeRevisionHistory ?? false;
  const { snapshot } = bundle.pack;

  const lines: string[] = [];

  // Title
  lines.push(`# ${bundle.title}`);
  lines.push('');

  // Subject metadata
  const subj = bundle.subject;
  lines.push(`**Subject:** ${subj.displayName}`);
  if (subj.subtitle) lines.push(`**Subtitle:** ${subj.subtitle}`);
  if (subj.organization) lines.push(`**Organization:** ${subj.organization}`);
  if (subj.role) lines.push(`**Role:** ${subj.role}`);
  lines.push('');

  // Export metadata
  lines.push(`**Exported:** ${bundle.provenance.exportedAt}`);
  lines.push(`**Pack:** ${bundle.pack.packId} v${bundle.pack.packVersion}`);
  lines.push(`**Pack Digest:** ${bundle.pack.packDigest}`);
  lines.push('');

  // Sections in pack order
  for (const section of snapshot.sections) {
    lines.push(`## ${section.label}`);
    if (section.description) {
      lines.push('');
      lines.push(section.description);
    }
    lines.push('');

    for (const promptId of section.promptIds) {
      const prompt = findPrompt(snapshot, promptId);
      if (!prompt) continue;

      const responded = hasResponse(bundle.responses, promptId);
      if (!responded && !includeUnanswered) continue;

      const lensLabel = findLensLabel(snapshot, prompt.lensId);
      const response = getResponseForPrompt(bundle.responses, promptId);

      lines.push(`### ${lensLabel}`);
      lines.push('');
      lines.push(prompt.text);
      lines.push('');

      if (response && response.revisions.length > 0) {
        if (includeRevisionHistory) {
          for (let i = 0; i < response.revisions.length; i++) {
            const rev = response.revisions[i];
            if (i > 0) lines.push('');
            lines.push(`*Revision ${i + 1} — ${rev.capturedAt} [${rev.source}]*`);
            lines.push('');
            lines.push(rev.text);
          }
        } else {
          const current = response.revisions[response.revisions.length - 1];
          lines.push(`*${current.capturedAt}*`);
          lines.push('');
          lines.push(current.text);
        }
      } else {
        lines.push('*(no response)*');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// renderPlainText
// ---------------------------------------------------------------------------

export function renderPlainText(bundle: WolfRecordBundle, options?: HumanExportOptions): string {
  const includeUnanswered = options?.includeUnanswered ?? false;
  const includeRevisionHistory = options?.includeRevisionHistory ?? false;
  const { snapshot } = bundle.pack;

  const lines: string[] = [];
  const rule = '='.repeat(72);
  const subRule = '-'.repeat(72);

  lines.push(rule);
  lines.push(bundle.title);
  lines.push(rule);
  lines.push('');

  // Subject metadata
  const subj = bundle.subject;
  lines.push(`Subject:       ${subj.displayName}`);
  if (subj.subtitle) lines.push(`Subtitle:      ${subj.subtitle}`);
  if (subj.organization) lines.push(`Organization:  ${subj.organization}`);
  if (subj.role) lines.push(`Role:          ${subj.role}`);
  lines.push('');

  lines.push(`Exported:      ${bundle.provenance.exportedAt}`);
  lines.push(`Pack:          ${bundle.pack.packId} v${bundle.pack.packVersion}`);
  lines.push(`Pack Digest:   ${bundle.pack.packDigest}`);
  lines.push('');

  // Sections in pack order
  for (const section of snapshot.sections) {
    lines.push(rule);
    lines.push(section.label.toUpperCase());
    lines.push(rule);
    if (section.description) {
      lines.push('');
      lines.push(section.description);
    }
    lines.push('');

    for (const promptId of section.promptIds) {
      const prompt = findPrompt(snapshot, promptId);
      if (!prompt) continue;

      const responded = hasResponse(bundle.responses, promptId);
      if (!responded && !includeUnanswered) continue;

      const lensLabel = findLensLabel(snapshot, prompt.lensId);
      const response = getResponseForPrompt(bundle.responses, promptId);

      lines.push(subRule);
      lines.push(`[${lensLabel}]`);
      lines.push('');
      lines.push(prompt.text);
      lines.push('');

      if (response && response.revisions.length > 0) {
        if (includeRevisionHistory) {
          for (let i = 0; i < response.revisions.length; i++) {
            const rev = response.revisions[i];
            if (i > 0) lines.push('');
            lines.push(`Revision ${i + 1} -- ${rev.capturedAt} [${rev.source}]`);
            lines.push('');
            lines.push(rev.text);
          }
        } else {
          const current = response.revisions[response.revisions.length - 1];
          lines.push(`Captured: ${current.capturedAt}`);
          lines.push('');
          lines.push(current.text);
        }
      } else {
        lines.push('(no response)');
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
