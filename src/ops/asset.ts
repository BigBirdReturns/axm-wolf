import type { AssetStatus, OpsAssetPassport, ScalarFact } from './types.js';

export function createAssetPassport(input: {
  assetId: string;
  displayName: string;
  category: string;
  siteLabel?: string | null;
  locationLabel?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installedAt?: string | null;
  status?: AssetStatus;
  now?: string;
}): OpsAssetPassport {
  const displayName = input.displayName.trim();
  const category = input.category.trim();
  if (displayName.length === 0) throw new Error('An asset passport requires a display name');
  if (category.length === 0) throw new Error('An asset passport requires a category');

  const now = input.now ?? new Date().toISOString();
  return {
    assetId: input.assetId,
    displayName,
    category,
    siteLabel: normalizeOptionalText(input.siteLabel),
    locationLabel: normalizeOptionalText(input.locationLabel),
    manufacturer: normalizeOptionalText(input.manufacturer),
    model: normalizeOptionalText(input.model),
    serialNumber: normalizeOptionalText(input.serialNumber),
    installedAt: normalizeOptionalText(input.installedAt),
    status: input.status ?? 'unknown',
    attributes: {},
    evidenceArtifactIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateAssetPassport(
  asset: OpsAssetPassport,
  patch: Partial<
    Pick<
      OpsAssetPassport,
      | 'displayName'
      | 'siteLabel'
      | 'locationLabel'
      | 'manufacturer'
      | 'model'
      | 'serialNumber'
      | 'installedAt'
      | 'status'
    >
  >,
  now = new Date().toISOString(),
): OpsAssetPassport {
  const displayName = patch.displayName === undefined ? asset.displayName : patch.displayName.trim();
  if (displayName.length === 0) throw new Error('An asset passport requires a display name');

  return {
    ...asset,
    ...patch,
    displayName,
    siteLabel: patch.siteLabel === undefined ? asset.siteLabel : normalizeOptionalText(patch.siteLabel),
    locationLabel:
      patch.locationLabel === undefined ? asset.locationLabel : normalizeOptionalText(patch.locationLabel),
    manufacturer:
      patch.manufacturer === undefined ? asset.manufacturer : normalizeOptionalText(patch.manufacturer),
    model: patch.model === undefined ? asset.model : normalizeOptionalText(patch.model),
    serialNumber:
      patch.serialNumber === undefined ? asset.serialNumber : normalizeOptionalText(patch.serialNumber),
    installedAt:
      patch.installedAt === undefined ? asset.installedAt : normalizeOptionalText(patch.installedAt),
    updatedAt: now,
  };
}

export function setAssetAttribute(
  asset: OpsAssetPassport,
  key: string,
  value: ScalarFact,
  now = new Date().toISOString(),
): OpsAssetPassport {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) throw new Error('An asset attribute requires a key');
  return {
    ...asset,
    attributes: { ...asset.attributes, [normalizedKey]: value },
    updatedAt: now,
  };
}

export function attachEvidenceToAsset(
  asset: OpsAssetPassport,
  artifactId: string,
  now = new Date().toISOString(),
): OpsAssetPassport {
  const normalizedId = artifactId.trim();
  if (normalizedId.length === 0) throw new Error('An evidence artifact ID cannot be empty');
  return {
    ...asset,
    evidenceArtifactIds: asset.evidenceArtifactIds.includes(normalizedId)
      ? asset.evidenceArtifactIds
      : [...asset.evidenceArtifactIds, normalizedId],
    updatedAt: now,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
