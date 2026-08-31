import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

// useCallback keeps tool registration stable across renders.
const useGoToCanvas = () => {
  const navigate = useNavigate();

  return useCallback(
    (input: Readonly<{ canvasId: string }>) =>
      navigate({ params: { canvasId: input.canvasId }, to: "/canvas/$canvasId" }),
    [navigate],
  );
};

export { useGoToCanvas };
