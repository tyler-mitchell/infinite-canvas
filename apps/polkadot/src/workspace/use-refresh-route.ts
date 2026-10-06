import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

// Re-run the active canvas route loader.
// useCallback keeps tool registration stable across renders.
const useRefreshRoute = () => {
  const router = useRouter();

  return useCallback(() => {
    void router.invalidate();
  }, [router]);
};

export { useRefreshRoute };
