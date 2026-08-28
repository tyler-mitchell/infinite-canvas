import { observable } from "@legendapp/state";

/**
 * An action that rejected with nobody to catch it.
 *
 * The app fires its writes as `void promise.then(…)` — 26 sites across 8 files — so a rejection
 * has no handler and reaches `unhandledrejection` and nowhere else. Measured 2026-08-28: nothing
 * in the app or the framework listens for it, so a failed restore, rename, or create was a press
 * that silently did nothing.
 *
 * One listener rather than 26 catches. A rejection that nothing handled is already collected by the
 * platform; what was missing was somewhere for it to go.
 */

const actionFailure$ = observable<string | null>(null);

/**
 * What is true of the work, not what the database said.
 *
 * `getSaveAdmission` sets the rule this follows: the raw error names a record and a revision, and a
 * reader cannot tell from it whether anything of theirs is at risk. The reason goes to the console,
 * which is where the person who can act on it is looking.
 */
const FAILURE_MESSAGE = "Something did not finish";

const watchForUnhandledRejections = () => {
  const onRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection", event.reason);
    actionFailure$.set(FAILURE_MESSAGE);
  };

  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
  };
};

export { actionFailure$, watchForUnhandledRejections };
