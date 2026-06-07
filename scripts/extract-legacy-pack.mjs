import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('reference/legacy-v0/index.html', 'utf8');
const match = html.match(/const ERAS = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Could not find legacy ERAS array');
const eras = vm.runInNewContext(match[1]);

const lensIds = new Map([
  ['The Room', 'room'],
  ['The Decision', 'decision'],
  ['The Person', 'person'],
  ['The Moment', 'moment'],
  ['The Thing Nobody Said', 'thing-nobody-said']
]);

function slug(input) {
  return input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 8)
    .join('-');
}

function sectionId(legacyId) {
  return legacyId.replaceAll('_', '-');
}

const migration = {};
const inventory = {
  source: 'reference/legacy-v0/index.html',
  sourceLibraryComment: 'QUESTION LIBRARY — 62 questions, 7 eras',
  auditedAt: new Date(0).toISOString(),
  actualSectionCount: eras.length,
  actualPromptCount: 0,
  sections: []
};

const pack = {
  schemaVersion: 1,
  packId: 'wolfs-deposition',
  packVersion: '1.0.0',
  engineVersion: '>=0.1.0 <1.0.0',
  title: "The Wolf's Deposition",
  subtitle: 'A forty-year institutional record, captured one answer at a time.',
  description: 'Pulp Fiction-inspired deposition framing for preserving William Sandhu’s institutional knowledge in his own words.',
  subjectDefaults: {
    displayName: 'William Sandhu',
    subtitle: 'Oral History',
    organization: null,
    role: null
  },
  theme: {
    accent: '#7a4a1e'
  },
  lenses: Array.from(lensIds.entries()).map(([label, id]) => ({ id, label })),
  sections: [],
  prompts: [],
  exportDefaults: {
    basename: 'wolfs-deposition-william-sandhu'
  }
};

const usedPromptIds = new Set();
for (const era of eras) {
  const newSectionId = sectionId(era.id);
  const promptIds = [];
  inventory.sections.push({
    legacyId: era.id,
    sectionId: newSectionId,
    label: era.label,
    rangeLabel: era.years,
    promptCount: era.questions.length,
    prompts: []
  });
  for (const [index, question] of era.questions.entries()) {
    const oldKey = `${era.id}__${index}`;
    let base = `${newSectionId}.${slug(question.text)}`;
    let id = base;
    let disambiguator = 2;
    while (usedPromptIds.has(id)) id = `${base}-${disambiguator++}`;
    usedPromptIds.add(id);
    migration[oldKey] = id;
    promptIds.push(id);
    const lensId = lensIds.get(question.type);
    if (!lensId) throw new Error(`Unknown lens ${question.type}`);
    const prompt = {
      id,
      kind: 'long_text',
      lensId,
      text: question.text,
      context: question.sub,
      tags: []
    };
    pack.prompts.push(prompt);
    inventory.sections.at(-1).prompts.push({
      legacyKey: oldKey,
      promptId: id,
      lensLabel: question.type,
      text: question.text,
      context: question.sub
    });
    inventory.actualPromptCount += 1;
  }
  pack.sections.push({
    id: newSectionId,
    label: era.label,
    rangeLabel: era.years,
    description: null,
    promptIds
  });
}

mkdirSync('src/packs/wolfs-deposition', { recursive: true });
writeFileSync('src/packs/wolfs-deposition/wolfs-deposition.wolfpack.json', `${JSON.stringify(pack, null, 2)}\n`);
writeFileSync('src/packs/wolfs-deposition/legacy-id-migration-map.json', `${JSON.stringify(migration, null, 2)}\n`);
writeFileSync('reference/legacy-v0/prompt-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`);
