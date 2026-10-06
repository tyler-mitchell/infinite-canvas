import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
} from "@hyphened/infinite-canvas/legacy";
import { useState } from "react";
import { CommandPalette } from "../showcases/command-palette.tsx";
import { exposeCanvasVerification } from "../showcases/verify.ts";

type BodyContentWindowKind = "form" | "list" | "prose";

const CONTROL_CLASS =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30";

const LABEL_CLASS = "grid gap-1 text-[10px] uppercase tracking-wider text-muted-foreground";

function ContactForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <form
      className="grid gap-2.5 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        // `String(file)` returns "[object File]" for a File, so this code narrows the value.
        const name = data.get("name");
        const tier = data.get("tier");

        setSubmitted(
          `${typeof name === "string" && name !== "" ? name : "anonymous"} · ${
            typeof tier === "string" ? tier : "unknown"
          }`,
        );
      }}
    >
      <label className={LABEL_CLASS}>
        Name
        <input className={CONTROL_CLASS} name="name" placeholder="Ada Lovelace" type="text" />
      </label>

      <label className={LABEL_CLASS}>
        Tier
        <select className={CONTROL_CLASS} defaultValue="standard" name="tier">
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </label>

      <label className={LABEL_CLASS}>
        Notes
        <textarea className={CONTROL_CLASS} name="notes" rows={3} />
      </label>

      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <input name="subscribe" type="checkbox" />
        Subscribe to updates
      </label>

      <button
        className="rounded bg-cyan-400/15 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-400/25"
        type="submit"
      >
        Submit
      </button>

      {submitted === null ? null : (
        <p className="rounded bg-emerald-400/10 px-2 py-1.5 text-[10px] text-emerald-200">
          Submitted: {submitted}
        </p>
      )}
    </form>
  );
}

function ActivityList() {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    id: index,
    label: `Event ${String(index + 1).padStart(2, "0")}`,
    detail: index % 3 === 0 ? "deploy" : index % 3 === 1 ? "build" : "test",
  }));

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li className="flex items-center justify-between px-3 py-1.5 text-[11px]" key={row.id}>
          <span className="text-foreground/80">{row.label}</span>
          <span className="font-mono text-[9px] text-muted-foreground">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}

const registry = defineInfiniteCanvasWindowRegistry<BodyContentWindowKind>({
  form: {
    kind: "form",
    // Native text selection gives controls the caret and drag selection.
    renderBody: () => <ContactForm />,
    textSelection: "native",
  },
  list: {
    kind: "list",
    renderBody: () => <ActivityList />,
    // Native scroll gives the wheel to the list instead of the camera.
    wheelBehavior: "native-scroll",
  },
  prose: {
    kind: "prose",
    renderBody: () => (
      <div className="grid gap-2 p-3 text-[11px] leading-relaxed text-foreground/75">
        <p>
          Drag across this paragraph. The selection should land in the text, not start a marquee
          over the windows behind it — that is <code>textSelection: &quot;native&quot;</code>.
        </p>
        <p>
          Press <kbd className="rounded border border-border px-1">Tab</kbd> with this window active
          and focus should enter the form window&apos;s first field, cycle its controls, and stop at
          the edges. <kbd className="rounded border border-border px-1">Escape</kbd> hands focus
          back to the canvas, where the hotkeys work again.
        </p>
      </div>
    ),
    textSelection: "native",
  },
});

const initialState = createInfiniteCanvasState<BodyContentWindowKind>({
  windows: [
    createInfiniteCanvasWindow({
      id: "form",
      kind: "form",
      rect: { height: 300, width: 280, x: -320, y: -150 },
      title: "Contact form",
    }),
    createInfiniteCanvasWindow({
      id: "list",
      kind: "list",
      rect: { height: 300, width: 260, x: 0, y: -150 },
      title: "Activity",
    }),
    createInfiniteCanvasWindow({
      id: "prose",
      kind: "prose",
      rect: { height: 190, width: 300, x: -160, y: 175 },
      title: "Read me",
    }),
  ],
});

export const Route = createFileRoute("/body-content")({
  component: BodyContentShowcase,
  staticData: {
    showcase: {
      description: "Forms, scrolling lists, and selectable prose inside window bodies.",
      order: 9,
      title: "Body Content",
    },
  },
});

function BodyContentShowcase() {
  return (
    <div className="absolute inset-0">
      <InfiniteCanvasDesktop
        tools
        initialState={initialState}
        renderOverlay={() => {
          // This route supplies the tabbable controls for focus checks.
          exposeCanvasVerification();

          return <CommandPalette />;
        }}
        subtitle="Real controls in window bodies: the caret, the wheel, and the tab order all have two claimants."
        title="Body Content"
        windowDefinitions={registry}
      />
    </div>
  );
}
