import type React from "react";
import { useState } from "react";

/**
 * A window, as a real React component owning real state.
 *
 * This is the half of the pipeline the compositor must not touch. The compositor decides *which*
 * element a pointer landed on and nothing else; the click it dispatches is a real DOM event, React's
 * own delegated listener picks it up, and the component decides what its state becomes. Nothing here
 * knows it is being captured, and that is the whole point — if a window had to be written differently
 * to live on the canvas, the approach would not survive contact with a real app.
 *
 * The meta line reads from `draft` deliberately: it is the tell that React re-rendered, rather than
 * an uncontrolled input simply showing what was typed into it.
 */
/**
 * Each window carries an accent, the way a real note carries a tag colour.
 *
 * Not decoration: the signature pass reports the colour of a window's *content*, so a window has to
 * actually have a colour for that to mean anything. Before this, every note was the same near-white
 * text on the same ground and the light field could only ever produce a grey wash — the measurement
 * was correct and the thing it measured was uniform.
 */
const ACCENTS = [28, 68, 152, 202, 272, 326];

export const Note = ({
  height,
  index,
  width,
}: {
  height: number;
  index: number;
  width: number;
}) => {
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState("");
  // Chroma kept modest on purpose: the light field amplifies whatever hue it finds, so a garish
  // accent becomes a garish room.
  const accent = `oklch(0.79 0.15 ${String(ACCENTS[index % ACCENTS.length])})`;

  /*
   * The window sizes itself to its layer.
   *
   * Not a detail: a note that is 512 wide and whatever tall its content came to leaves most of a
   * layer unwritten, and the quad draws that as a black band. Setting it from outside after mount
   * worked but forced a relayout that pushed a single-window repaint from 4 ms to 136 ms — a
   * window's own size belongs to the window.
   *
   * The layer is shaped like the window it will be drawn into, so the mapping is 1:1. A square
   * texture on a 300×220 quad squashed every note vertically by 27%.
   */
  return (
    <div
      className="note"
      // Glass on the window itself: its bevel refracts the light field around its own edge, which
      // is a thing only a material with a backdrop can do.
      data-surface="glass"
      style={{ "--accent": accent, height, width } as React.CSSProperties}
    >
      <div className="note-chrome" />
      <div className="note-body">
        {/*
          The whole declaration a shader material needs, on the element it applies to.

          One word. The corner radius comes from the stylesheet, which already says it, and the
          colour from the inherited accent — the compositor reads both while it is walking this
          subtree for hit-test geometry anyway. The component says what it *is*; nothing here
          reaches for a canvas, a ref, or a renderer.
        */}
        <span className="note-tag" data-surface="edge">
          {done ? "done" : "open"}
        </span>
        <h2>Meeting notes {index}</h2>
        <p>
          The compositor&rsquo;s constraint is texture residency, not draw calls. Half a million
          textured quads cost 1.6 ms in a single instanced draw.
        </p>
        <ul>
          <li>256 layers is the hard array cap</li>
          <li>An 8192&sup2; atlas holds ~341 windows</li>
          <li>Re-capture is a scheduling problem</li>
        </ul>
        <input
          className="note-field"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Add a note…"
          type="text"
          value={draft}
        />
        <button
          className="note-action"
          data-done={done ? "true" : undefined}
          data-surface="sheen"
          onClick={() => {
            setDone(!done);
          }}
          type="button"
        >
          {done ? "Done ✓" : "Mark as done"}
        </button>
        <p className="note-meta">
          {draft.length === 0
            ? "edited 2 minutes ago · 3 links"
            : `${String(draft.length)} characters · rendered by React`}
        </p>
      </div>
    </div>
  );
};
