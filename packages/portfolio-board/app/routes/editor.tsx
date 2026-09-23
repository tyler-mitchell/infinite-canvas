import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useWebMCP } from "use-webmcp-tool";
import { Button } from "portfolio-board";
import { PortfolioBoard, type BoardMode } from "../../portfolio/board.tsx";
import { createCanvas } from "../../portfolio/canvas.ts";
import { getPortfolio, savePortfolio } from "../../server/portfolio.functions.ts";

export const Route = createFileRoute("/editor")({
  ssr: false,
  loader: () => getPortfolio(),
  component: Editor,
});

function Editor() {
  const saved = Route.useLoaderData();
  const savedVersion = useRef<
    { id: null; revision: 0 } | { id: string; revision: number }
  >(saved ? { id: saved.id, revision: saved.revision } : { id: null, revision: 0 });
  const [mode, setMode] = useState<BoardMode>("edit");
  const [canvas] = useState(() => createCanvas(saved?.document));
  const save = useServerFn(savePortfolio);
  const mutation = useMutation({
    scope: { id: "portfolio.save" },
    mutationFn: async (publishRequested: boolean) => {
      const result = await save({
        data: { ...savedVersion.current, document: canvas.state.document.peek(), publish: publishRequested },
      });
      if ("id" in result) savedVersion.current = { id: result.id, revision: result.revision };
      return result;
    },
  });
  useWebMCP({
    name: "portfolio.save",
    description: "Save the portfolio draft. Returns a conflict if another session saved first.",
    execute: () => mutation.mutateAsync(false),
  });
  useWebMCP({
    name: "portfolio.publish",
    description: "Save and publish the current portfolio. The published copy is publicly readable.",
    execute: () => mutation.mutateAsync(true),
  });
  return (
    <PortfolioBoard
      canvas={canvas}
      mode={mode}
      onModeChange={setMode}
      controls={
        <>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(false)}>Save</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>Publish</Button>
          {mutation.isError && <p role="alert">Save failed. Your edits remain here. Try again.</p>}
          {mutation.data?.status === "unauthenticated" && (
            <a href="/auth/sign-in" target="_blank" rel="noreferrer">Sign in again, then retry saving here</a>
          )}
          {mutation.data?.status === "conflict" && (
            <p role="alert">
              Another session saved changes. Your edits remain here.{" "}
              <a href="/editor">Discard local edits and load the saved version</a>
            </p>
          )}
          {mutation.data?.status === "saved" && <span role="status">Last save completed</span>}
          {mutation.data?.status === "published" && <a href={`/p/${mutation.data.id}`}>View published portfolio</a>}
        </>
      }
    />
  );
}
