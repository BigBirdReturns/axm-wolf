import type { CapturePack } from './types.js';

function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalizeValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalizePack(pack: CapturePack): string {
  return canonicalizeValue(pack);
}

export async function digestPack(pack: CapturePack): Promise<string> {
  const data = new TextEncoder().encode(canonicalizePack(pack));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
