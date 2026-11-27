import { isDevMode } from '@angular/core';

// Temporary, opt-in diagnostics: sessionStorage.setItem('kitafix.login.timing', '1').
// Remove the session key to stop. Never record request inputs, results, or errors.
export async function timeLoginStage<T>(stage: string, operation: () => PromiseLike<T>): Promise<T> {
  let enabled = false;
  try {
    enabled = isDevMode() && sessionStorage.getItem('kitafix.login.timing') === '1';
  } catch { /* Storage may be unavailable. */ }
  const start = enabled ? performance.now() : 0;
  try {
    return await operation();
  } finally {
    if (enabled) console.debug(`[login timing] ${stage}: ${Math.round(performance.now() - start)} ms`);
  }
}
