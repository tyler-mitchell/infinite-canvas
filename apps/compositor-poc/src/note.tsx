import type React from "react";
import { useState } from "react";

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
  // Low accent chroma offsets the increase in the light shader.
  const accent = `oklch(0.79 0.15 ${String(ACCENTS[index % ACCENTS.length])})`;

  // The DOM size matches the texture layer and prevents blank bands and distortion.
  return (
    <div
      className="note"
      // Glass samples the light field behind the window rim.
      data-surface="glass"
      style={{ "--accent": accent, height, width } as React.CSSProperties}
    >
      <div className="note-chrome" />
      <div className="note-body">
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
