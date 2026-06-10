import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_INFINITE_CANVAS_ZOOM } from "infinite-canvas";

export const Route = createFileRoute("/welcome")({
  component: WelcomeShowcase,
  staticData: {
    showcase: {
      description: "What this playground is and how to add a showcase.",
      order: 0,
      title: "Welcome",
    },
  },
});

function WelcomeShowcase() {
  return (
    <article className="max-w-xl p-10 text-sm leading-relaxed text-foreground/80">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Welcome</h2>
      <p className="mb-3">
        This playground is the consumer surface for the <Code>infinite-canvas</Code> framework.
        Every demo imports the package straight from source, so framework edits hot-reload into this
        app with no build step.
      </p>
      <p className="mb-3">
        Source link proof — the framework's default zoom policy reports:{" "}
        <Code data-testid="framework-status">
          zoom {DEFAULT_INFINITE_CANVAS_ZOOM.minZoom}–{DEFAULT_INFINITE_CANVAS_ZOOM.maxZoom}
        </Code>
      </p>
      <h3 className="mt-6 mb-2 font-semibold text-foreground">Adding a showcase</h3>
      <p>
        Add a file under <Code>src/routes/</Code> that declares <Code>staticData.showcase</Code>;
        the sidebar picks it up automatically. Keep showcases deterministic: fixed initial layouts,
        persistence off unless the demo is about persistence.
      </p>
    </article>
  );
}

function Code(props: React.ComponentProps<"code">) {
  return (
    <code
      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
      {...props}
    />
  );
}
