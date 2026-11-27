import { useEffect } from 'react';
import { ask } from './confirm';

/**
 * Unsaved changes. Whichever editor is open reports whether it has any (useReportDirty); anything that would leave it
 * (opening another page, switching site, the Preview tab, closing the tab) first asks, so edits are never lost silently.
 */
let dirty = false;

export function useReportDirty(value: boolean) {
  useEffect(() => {
    dirty = value;
    return () => { dirty = false; };
  }, [value]);
}

/** Resolves true when it is fine to leave: nothing is unsaved, or the person chose to discard it. */
export async function confirmLeave(): Promise<boolean> {
  if (!dirty) return true;
  const ok = await ask({
    title: 'Discard your changes?',
    message: 'You have edits that are not saved. If you leave now they are lost.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
  });
  if (ok) dirty = false;
  return ok;
}

/** Runs `go` when it is fine to leave the editor. */
export async function leaveThen(go: () => void) {
  if (await confirmLeave()) go();
}

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
