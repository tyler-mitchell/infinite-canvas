// This lock serializes default-name reads and writes within one tab.
const NAMING_LOCK_TIMEOUT_MS = 10_000;

// The chain swallows rejections. Each caller still receives its own rejection.
let tail: Promise<unknown> = Promise.resolve();

// The caller receives the original work promise without the chain timeout.
const withNamingLock = <T>(
  work: () => Promise<T>,
  timeoutMs = NAMING_LOCK_TIMEOUT_MS,
): Promise<T> => {
  const next = tail.then(work, work);

  tail = Promise.race([
    next.catch(() => undefined),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);

      // Node timers can unref. Browser timers cannot.
      (timer as unknown as { unref?: () => void }).unref?.();
    }),
  ]);

  return next;
};

export { NAMING_LOCK_TIMEOUT_MS, withNamingLock };
