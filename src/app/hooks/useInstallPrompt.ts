import { useEffect, useState } from 'react';

/**
 * Install flow (DESIGN.md 10.4).
 *
 * - captures `beforeinstallprompt` when the browser fires it
 * - exposes a standalone-display check
 * - remembers a session-scoped dismissal so the in-app install action does
 *   not re-nag after the user closes it
 */

const DISMISS_KEY = 'axm-wolf:install-dismissed';

/**
 * The `beforeinstallprompt` event is not part of the standard DOM lib types.
 * This is a focused local declaration of the subset this hook uses.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallPromptState = {
  /** A captured `beforeinstallprompt` event is available to trigger. */
  canInstall: boolean;
  /** Triggers the captured install prompt, if any. */
  promptInstall: () => Promise<void>;
  /** The app is already running in standalone (installed) display mode. */
  isStandalone: boolean;
  /** The user dismissed the in-app install action this session. */
  dismissed: boolean;
  /** Marks the in-app install action as dismissed for this session. */
  dismiss: () => void;
};

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(mql?.matches) || iosStandalone;
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onBeforeInstallPrompt(event: Event): void {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled(): void {
      setDeferredEvent(null);
      setIsStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<void> {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }

  function dismiss(): void {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sessionStorage unavailable (e.g. privacy mode) -- dismissal is
      // session-only anyway, so just keep it in memory.
    }
  }

  return {
    canInstall: deferredEvent !== null,
    promptInstall,
    isStandalone,
    dismissed,
    dismiss,
  };
}
