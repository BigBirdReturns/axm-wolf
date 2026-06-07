import { WolfValidationError } from './errors.js';
import type { CapturePack } from './types.js';

const slugPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const semverPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WolfValidationError(`${path} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) throw new WolfValidationError(`${path} contains forbidden key ${key}`);
  }
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new WolfValidationError(`${path}.${key} is not allowed`);
  }
}

function requiredString(value: unknown, path: string, max = 4000): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new WolfValidationError(`${path} must be a non-empty string up to ${max} characters`);
  }
  return value;
}

function optionalString(value: unknown, path: string, max = 2000): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > max) throw new WolfValidationError(`${path} must be a string up to ${max} characters or null`);
  return value;
}

function assertSlug(value: string, path: string): void {
  if (!slugPattern.test(value)) throw new WolfValidationError(`${path} must be a stable lowercase slug`);
}

function assertNoHtml(value: string, path: string): void {
  if (/<\/?[a-z][\s\S]*>/i.test(value)) throw new WolfValidationError(`${path} must be plain text, not HTML`);
  if (/javascript:/i.test(value)) throw new WolfValidationError(`${path} must not contain JavaScript URLs`);
}

export function validatePack(input: unknown): CapturePack {
  assertPlainObject(input, 'pack');
  assertAllowedKeys(input, ['schemaVersion', 'packId', 'packVersion', 'engineVersion', 'title', 'subtitle', 'description', 'subjectDefaults', 'theme', 'lenses', 'sections', 'prompts', 'exportDefaults'], 'pack');
  if (input.schemaVersion !== 1) throw new WolfValidationError('schemaVersion must be 1');
  const packId = requiredString(input.packId, 'packId', 120);
  assertSlug(packId, 'packId');
  const packVersion = requiredString(input.packVersion, 'packVersion', 80);
  if (!semverPattern.test(packVersion)) throw new WolfValidationError('packVersion must be semantic versioning');
  const engineVersion = requiredString(input.engineVersion, 'engineVersion', 80);
  if (!engineVersion.includes('0.1.0')) throw new WolfValidationError('engineVersion is incompatible with this engine');
  const title = requiredString(input.title, 'title', 160);
  assertNoHtml(title, 'title');
  const subtitle = optionalString(input.subtitle, 'subtitle', 240) ?? null;
  if (subtitle) assertNoHtml(subtitle, 'subtitle');
  const description = optionalString(input.description, 'description', 1000) ?? null;
  if (description) assertNoHtml(description, 'description');

  assertPlainObject(input.theme, 'theme');
  assertAllowedKeys(input.theme, ['accent'], 'theme');
  const accent = requiredString(input.theme.accent, 'theme.accent', 7);
  if (!hexColorPattern.test(accent)) throw new WolfValidationError('theme.accent must be a safe six-digit hex color');

  const lensesInput = input.lenses;
  if (!Array.isArray(lensesInput) || lensesInput.length < 1 || lensesInput.length > 100) throw new WolfValidationError('lenses must contain 1 to 100 entries');
  const lensIds = new Set<string>();
  const lenses = lensesInput.map((lens, index) => {
    assertPlainObject(lens, `lenses[${index}]`);
    assertAllowedKeys(lens, ['id', 'label'], `lenses[${index}]`);
    const id = requiredString(lens.id, `lenses[${index}].id`, 80);
    assertSlug(id, `lenses[${index}].id`);
    if (lensIds.has(id)) throw new WolfValidationError(`duplicate lens id ${id}`);
    lensIds.add(id);
    const label = requiredString(lens.label, `lenses[${index}].label`, 80);
    assertNoHtml(label, `lenses[${index}].label`);
    return { id, label };
  });

  const promptsInput = input.prompts;
  if (!Array.isArray(promptsInput) || promptsInput.length < 1 || promptsInput.length > 2000) throw new WolfValidationError('prompts must contain 1 to 2000 entries');
  const promptIds = new Set<string>();
  const prompts = promptsInput.map((prompt, index) => {
    assertPlainObject(prompt, `prompts[${index}]`);
    assertAllowedKeys(prompt, ['id', 'kind', 'lensId', 'text', 'context', 'tags', 'required', 'suggestedFollowUp'], `prompts[${index}]`);
    const id = requiredString(prompt.id, `prompts[${index}].id`, 160);
    assertSlug(id, `prompts[${index}].id`);
    if (promptIds.has(id)) throw new WolfValidationError(`duplicate prompt id ${id}`);
    promptIds.add(id);
    if (prompt.kind !== 'long_text') throw new WolfValidationError(`prompts[${index}].kind must be long_text`);
    const lensId = requiredString(prompt.lensId, `prompts[${index}].lensId`, 80);
    if (!lensIds.has(lensId)) throw new WolfValidationError(`unresolved lens ${lensId}`);
    const text = requiredString(prompt.text, `prompts[${index}].text`, 4000);
    assertNoHtml(text, `prompts[${index}].text`);
    const context = optionalString(prompt.context, `prompts[${index}].context`, 2000) ?? null;
    if (context) assertNoHtml(context, `prompts[${index}].context`);
    const tags = prompt.tags === undefined ? [] : prompt.tags;
    if (!Array.isArray(tags) || tags.length > 32) throw new WolfValidationError(`prompts[${index}].tags must contain no more than 32 entries`);
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 80) throw new WolfValidationError(`prompts[${index}].tags entries must be strings`);
      assertNoHtml(tag, `prompts[${index}].tags`);
    }
    const required = prompt.required === undefined ? false : prompt.required;
    if (typeof required !== 'boolean') throw new WolfValidationError(`prompts[${index}].required must be boolean`);
    const suggestedFollowUp = optionalString(prompt.suggestedFollowUp, `prompts[${index}].suggestedFollowUp`, 2000) ?? null;
    if (suggestedFollowUp) assertNoHtml(suggestedFollowUp, `prompts[${index}].suggestedFollowUp`);
    return { id, kind: 'long_text' as const, lensId, text, context, tags, required, suggestedFollowUp };
  });

  const sectionsInput = input.sections;
  if (!Array.isArray(sectionsInput) || sectionsInput.length < 1 || sectionsInput.length > 100) throw new WolfValidationError('sections must contain 1 to 100 entries');
  const sectionIds = new Set<string>();
  const sections = sectionsInput.map((section, index) => {
    assertPlainObject(section, `sections[${index}]`);
    assertAllowedKeys(section, ['id', 'label', 'rangeLabel', 'description', 'promptIds'], `sections[${index}]`);
    const id = requiredString(section.id, `sections[${index}].id`, 120);
    assertSlug(id, `sections[${index}].id`);
    if (sectionIds.has(id)) throw new WolfValidationError(`duplicate section id ${id}`);
    sectionIds.add(id);
    const label = requiredString(section.label, `sections[${index}].label`, 120);
    assertNoHtml(label, `sections[${index}].label`);
    const rangeLabel = optionalString(section.rangeLabel, `sections[${index}].rangeLabel`, 120) ?? null;
    if (rangeLabel) assertNoHtml(rangeLabel, `sections[${index}].rangeLabel`);
    const description = optionalString(section.description, `sections[${index}].description`, 600) ?? null;
    if (description) assertNoHtml(description, `sections[${index}].description`);
    if (!Array.isArray(section.promptIds) || section.promptIds.length < 1 || section.promptIds.length > 500) {
      throw new WolfValidationError(`sections[${index}].promptIds must contain 1 to 500 prompt IDs`);
    }
    const promptIdsInSection = section.promptIds.map((promptId, promptIndex) => {
      const value = requiredString(promptId, `sections[${index}].promptIds[${promptIndex}]`, 160);
      if (!promptIds.has(value)) throw new WolfValidationError(`section ${id} references unknown prompt ${value}`);
      return value;
    });
    return { id, label, rangeLabel, description, promptIds: promptIdsInSection };
  });

  const subjectDefaults = input.subjectDefaults === undefined ? undefined : (() => {
    assertPlainObject(input.subjectDefaults, 'subjectDefaults');
    assertAllowedKeys(input.subjectDefaults, ['displayName', 'subtitle', 'organization', 'role'], 'subjectDefaults');
    return {
      displayName: requiredString(input.subjectDefaults.displayName, 'subjectDefaults.displayName', 160),
      subtitle: optionalString(input.subjectDefaults.subtitle, 'subjectDefaults.subtitle', 160) ?? null,
      organization: optionalString(input.subjectDefaults.organization, 'subjectDefaults.organization', 160) ?? null,
      role: optionalString(input.subjectDefaults.role, 'subjectDefaults.role', 160) ?? null
    };
  })();

  const exportDefaults = input.exportDefaults === undefined ? undefined : (() => {
    assertPlainObject(input.exportDefaults, 'exportDefaults');
    assertAllowedKeys(input.exportDefaults, ['basename'], 'exportDefaults');
    return { basename: optionalString(input.exportDefaults.basename, 'exportDefaults.basename', 160) ?? null };
  })();

  return { schemaVersion: 1, packId, packVersion, engineVersion, title, subtitle, description, subjectDefaults, theme: { accent }, lenses, sections, prompts, exportDefaults };
}
