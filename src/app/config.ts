// Deployment-mode configuration (DESIGN.md 9.4).
//
// Read at module-load time from Vite's build-time env (`import.meta.env`).
// Invalid configuration throws at startup so a misconfigured deployment
// fails loudly rather than silently falling back.

/** App version recorded on new and migrated records (DESIGN.md 8.4). */
export const APP_VERSION = '0.1.0';

export type DeployMode = 'platform' | 'single-pack';

export type AppConfig = {
  deployMode: DeployMode;
  /** Required (and meaningful) only in 'single-pack' mode. */
  defaultPackId: string | null;
};

const VALID_MODES: DeployMode[] = ['platform', 'single-pack'];

function isDeployMode(value: string): value is DeployMode {
  return (VALID_MODES as string[]).includes(value);
}

/**
 * Reads and validates the deployment configuration from `import.meta.env`.
 *
 * Throws if `VITE_DEPLOY_MODE` is set to a value other than 'platform' or
 * 'single-pack'. Throws if mode is 'single-pack' but `VITE_DEFAULT_PACK_ID`
 * is missing or empty.
 */
export function readAppConfig(env: Record<string, string | undefined> = import.meta.env as unknown as Record<string, string | undefined>): AppConfig {
  const rawMode = env.VITE_DEPLOY_MODE ?? 'platform';

  if (!isDeployMode(rawMode)) {
    throw new Error(
      `Invalid VITE_DEPLOY_MODE "${rawMode}": expected "platform" or "single-pack".`,
    );
  }

  const defaultPackId = env.VITE_DEFAULT_PACK_ID ?? null;

  if (rawMode === 'single-pack' && (!defaultPackId || defaultPackId.trim().length === 0)) {
    throw new Error('VITE_DEPLOY_MODE=single-pack requires VITE_DEFAULT_PACK_ID to be set.');
  }

  return {
    deployMode: rawMode,
    defaultPackId: rawMode === 'single-pack' ? defaultPackId : (defaultPackId ?? null),
  };
}

export const appConfig: AppConfig = readAppConfig();
