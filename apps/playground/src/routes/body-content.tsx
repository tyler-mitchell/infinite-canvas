import { createFileRoute } from "@tanstack/react-router";
import {
  createInfiniteCanvasState,
  createInfiniteCanvasWindow,
  defineInfiniteCanvasWindowRegistry,
  InfiniteCanvasDesktop,
} from "@infinite-canvas/react";
import { useState } from "react";
import { CommandPalette } from "../showcases/command-palette.tsx";
import { exposeCanvasDevHandle } from "../showcases/dev-handle.ts";

/**
 * Real interactive content inside window bodies — P6's exit criterion, and the surface FR-9's
 * focus containment needs in order to be falsifiable at all.
 *
 * Every other showcase puts *inert* content in its windows: a paragraph, a swatch, a label. Inert
 * content cannot reveal the body-content contract's failure modes, because none of them are about
 * painting. They are about **input ownership** — who gets the pointer, who gets the caret, who
 * gets the wheel — and you cannot test that with a div that wants none of them.
 *
 * So this route is deliberately made of the widgets that fight a canvas hardest:
 *
 * - **A form.** Text inputs want the caret, drag-select want the pointer the marquee also wants,
 *   and `Tab` wants an order the desktop also has opinions about. If focus containment is wrong,
 *   this is where it shows: `Tab` should cycle these fields and stop, never walking into the
 *   window beside it.
 * - **A scrollable list.** The wheel is contested. A canvas zooms on wheel; a list scrolls on it.
 *   `wheelBehavior: "native-scroll"` is the framework's answer, and this is where it is exercised.
 * - **Text selection.** Dragging across a paragraph must select the paragraph, not marquee-select
 *   the windows behind it. `textSelection: "native"` is the opt-in, and dragging here proves it.
 *
 * Nothing here uses a component library, deliberately. Plain platform controls test the
 * *framework*; a component library would test the component library's escape hatches.
 */

type BodyContentWindowKind = "form" | "list" | "prose";

const CONTROL_CLASS =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30";

const LABEL_CLASS = "grid gap-1 text-[10px] uppercase tracking-wider text-muted-foreground";

/**
 * A form with the four control types that behave differently under a transform: text, select,
 * checkbox, and a multi-line field. The submit button reports into local state rather than
 * anywhere real — the point is the interaction, not the payload.
 */
function ContactForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <form
      className="grid gap-2.5 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        // `FormData.get` returns `string | File | null`, so the values are narrowed rather than
        // stringified — `String(file)` would render "[object File]" into the UI.
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

/**
 * Enough rows that the list must scroll inside its own body. The window kind declares
 * `wheelBehavior: "native-scroll"`, so a wheel here scrolls the list rather than zooming the
 * canvas — the contested-wheel case the contract exists to settle.
 */
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
    // Text controls need the caret and the native selection behaviour that comes with it.
    // Without this the framework suppresses selection so a drag can marquee instead.
    renderBody: () => <ContactForm />,
    textSelection: "native",
  },
  list: {
    kind: "list",
    renderBody: () => <ActivityList />,
    // The wheel belongs to the list, not the camera, while the pointer is over this body.
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
        initialState={initialState}
        renderOverlay={(context) => {
          exposeCanvasDevHandle(context);

          return <CommandPalette />;
        }}
        subtitle="Real controls in window bodies: the caret, the wheel, and the tab order all have two claimants."
        title="Body Content"
        windowDefinitions={registry}
      />
    </div>
  );
}
