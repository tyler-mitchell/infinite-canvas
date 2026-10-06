import { observable } from "@legendapp/state";

const actionFailure$ = observable<string | null>(null);

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
