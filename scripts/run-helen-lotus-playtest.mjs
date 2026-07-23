import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHelenLotusPlaytest } from '../dist-tests/tests/playtest/helen-lotus.support.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'playtests/helen-lotus/generated');
const result = await runHelenLotusPlaytest();

await mkdir(outputDir, { recursive: true });
for (const filename of await readdir(outputDir)) {
  if (filename.endsWith('.wolfhandoff.json') || filename.endsWith('.wolfreturn.json')) {
    await unlink(resolve(outputDir, filename));
  }
}
await writeFile(resolve(outputDir, 'playtest-log.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(resolve(outputDir, 'dashboard-final.json'), `${JSON.stringify(result.finalDashboard, null, 2)}\n`);
for (const handoff of result.handoffs) await writeFile(resolve(outputDir, `${handoff.handoffId}.wolfhandoff.json`), `${JSON.stringify(handoff, null, 2)}\n`);
for (const analysisReturn of result.simulatedReturns) await writeFile(resolve(outputDir, `${analysisReturn.responseId}.wolfreturn.json`), `${JSON.stringify(analysisReturn, null, 2)}\n`);

const rows = result.events.map((event) => `| ${event.sequence} | ${event.recipient} | ${event.actor} | ${event.dashboardStatus} | ${event.action} | ${event.observed} |`).join('\n');
const dashboard = result.finalDashboard.map((entry) => `| ${entry.recipientLabel} | ${entry.status} | ${entry.answeredPrompts} | ${entry.acceptedClaims} | ${entry.rejectedClaims} | ${entry.nextAction} |`).join('\n');
const findings = result.findings.map((finding) => `- **${finding.severity.toUpperCase()} — ${finding.finding}** ${finding.evidence}`).join('\n');
const report = `# Helen → Lotus WOLF playtest receipt\n\n> ${result.syntheticDataNotice}\n\nThis is a deterministic local simulation. It made **zero runtime model API calls**. The analysis stage represents a human manually uploading each frozen \`.wolfhandoff.json\` to a paid ChatGPT or Claude subscription, then downloading or copying the structured \`.wolfreturn.json\` back into WOLF for validation and review.\n\n## Corrected value model\n\nThe survey is an ingestion surface. Each sourced response can yield smaller knowledge drops—symptoms, workarounds, constraints, decisions, failure modes, and unwritten rules. WOLF should cluster recurring drops, match them to versioned solution patterns, and qualify candidates against address, jurisdiction, current codes and rules, installed assets, availability, human preference, and maintenance burden. The result is a reviewed operating recipe, not a generic model summary. See \`../KNOWN-SOLUTION-SPACE.md\`.\n\n## Loop log\n\n| # | Recipient | Actor | Dashboard | Action | Observed consequence |\n|---:|---|---|---|---|---|\n${rows}\n\n## Final owner dashboard\n\n| Recipient | State | Answers | Accepted | Rejected | Next action |\n|---|---|---:|---:|---:|---|\n${dashboard}\n\n## Findings\n\n${findings}\n\n## Manual subscription protocol\n\n1. In WOLF, freeze the selected response revisions and export a \`.wolfhandoff.json\`.\n2. In ChatGPT or Claude, start a dedicated project/chat under the owner's subscription and attach the handoff. Do not enable connectors or external actions.\n3. Ask the model to follow the embedded instructions and return only the specified JSON.\n4. Save the result as \`.wolfreturn.json\`; do not paste model prose into the testimony.\n5. Import locally. Reject returns whose handoff ID, digest, revision citations, or exact quotes do not match.\n6. Show every derived claim as pending. The owner accepts, rejects, or turns it into a follow-up question.\n7. Only accepted claims may inform a proposed plan. The plan stays reversible and links back to the source revisions.\n\n## UX consequence\n\nThe dashboard should not merely say “completed.” It should say what dropped, where else the pattern occurs, whether the problem belongs to a known solution space, what local facts remain unverified, and the smallest compatible durable move. Helen and Lotus should see what they said, what WOLF recognized, what was verified externally, what the owner accepted, and how it reduces future explanation—without making them juggle another tool.\n`;
await writeFile(resolve(outputDir, 'PLAYTEST-REPORT.md'), report);

console.log(`Helen → Lotus playtest passed: ${result.events.length} logged transitions, ${result.handoffs.length} manual handoffs, ${result.reviews.length} reviewed claims.`);
console.log(`Evidence written to ${outputDir}`);
