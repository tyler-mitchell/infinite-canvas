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
export const Note = ({ index }: { index: number }) => {
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="note">
      <div className="note-chrome" />
      <div className="note-body">
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
