import { frameworkStatus } from "infinite-canvas";
import type { ShowcaseMeta } from "../shell/showcase.ts";

export const meta: ShowcaseMeta = {
  description: "What this playground is and how to add a showcase.",
  order: 0,
  title: "Welcome",
};

export default function WelcomeShowcase() {
  return (
    <article className="prose-panel">
      <h2>Welcome</h2>
      <p>
        This playground is the consumer surface for the <code>infinite-canvas</code> framework.
        Every demo here imports the package straight from source, so framework edits hot-reload into
        this app with no build step.
      </p>
      <p>
        Source link proof — the package currently reports:{" "}
        <code data-testid="framework-status">
          {frameworkStatus.name} · {frameworkStatus.phase}
        </code>
      </p>
      <h3>Adding a showcase</h3>
      <p>
        Drop a file at <code>src/showcases/&lt;slug&gt;.showcase.tsx</code> exporting a{" "}
        <code>meta</code> object and a default component. The shell discovers it automatically and
        serves it at <code>/&lt;slug&gt;</code>. Keep showcases deterministic: fixed initial
        layouts, persistence off unless the demo is about persistence.
      </p>
    </article>
  );
}
