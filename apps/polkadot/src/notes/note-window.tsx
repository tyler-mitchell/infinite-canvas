import {
  useInfiniteCanvasDispatch,
  useInfiniteCanvasDesktopPortalRoot,
  useInfiniteCanvasStore,
  type InfiniteCanvasState,
} from "@hyphened/infinite-canvas";
import { useObservable, useValue } from "@legendapp/state/react";
import { syncState } from "@legendapp/state";
import { useEffect, useRef } from "react";
import { tv } from "ui/tv";
import { Button } from "ui";

import {
  editNote,
  ensureNoteLoaded,
  externalWrites$,
  notes$,
  type NoteGateway,
} from "./note-store";
import { useLoaderData } from "@tanstack/react-router";

import { openItemWindow } from "../canvas/open-item";
import type { WindowKind } from "../canvas/window-registry";
import { getProjectContentOfKind, projectContent$ } from "../content/project-content";
import { connectItems } from "../relations/relation-store";
import { NoteEditor } from "./note-editor";

const noteWindow = tv({
  slots: {
    body: "flex flex-1 flex-col gap-2 px-5 pt-3.5 pb-4",
    editor: "flex flex-1 flex-col",
    // Sticky fades mark text beyond the visible scroll area.
    fade: "pointer-events-none sticky z-10 h-6 shrink-0 transition-opacity duration-150 ease-[var(--ease-swift)]",
    notice: "grid h-full place-items-center px-6 text-center text-[12.5px] text-[var(--ink-faint)]",
    // min-h-full keeps the framework body as the only scroll container.
    root: "flex min-h-full flex-col",
    title:
      "w-full bg-transparent text-[15px] font-medium tracking-[-0.015em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]",
  },
  variants: {
    edge: {
      bottom: { fade: "-mt-6 bottom-0 bg-gradient-to-t from-[var(--surface)] to-transparent" },
      top: { fade: "-mb-6 top-0 bg-gradient-to-b from-[var(--surface)] to-transparent" },
    },
    overflowing: {
      false: { fade: "opacity-0" },
      true: { fade: "opacity-100" },
    },
  },
});

// Find the framework scroll container before the note grows beyond it.
const findScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  const parent = element?.parentElement ?? null;

  if (parent === null) {
    return null;
  }

  return /auto|scroll|overlay/.test(globalThis.getComputedStyle(parent).overflowY)
    ? parent
    : findScrollParent(parent);
};

export function NoteWindowBody({
  gateway,
  noteId,
  windowId,
  windowTitle,
}: Readonly<{ gateway: NoteGateway; noteId: string; windowId: string; windowTitle: string }>) {
  const dispatch = useInfiniteCanvasDispatch<WindowKind>();
  // Read canvas state only when a mention opens.
  const store = useInfiniteCanvasStore();
  const { projectId } = useLoaderData({ from: "/canvas/$canvasId" });
  const mentionable =
    getProjectContentOfKind({
      kind: "note",
      listing: useValue(projectContent$[projectId]),
      projectId,
    }) ?? [];
  // The menu portal stays outside canvas transforms.
  const portalRoot = useInfiniteCanvasDesktopPortalRoot();
  const note = useValue(notes$[noteId]);
  const saveStatus$ = syncState(notes$[noteId]);
  const isLoaded = useValue(saveStatus$.isLoaded);
  const isGetting = useValue(saveStatus$.isGetting);
  const error = useValue(saveStatus$.error);
  // Primitive observables update independently in Legend State.
  const externalWrites = useValue(externalWrites$[noteId]) ?? 0;
  const rootRef = useRef<HTMLDivElement>(null);
  // Separate booleans prevent a stale root-object subscription.
  const above$ = useObservable(false);
  const below$ = useObservable(false);
  const above = useValue(above$);
  const below = useValue(below$);
  const styles = noteWindow();
  const noteTitle = note?.title;

  useEffect(() => {
    ensureNoteLoaded(noteId, gateway);
  }, [gateway, noteId]);

  // Scroll and resize changes both update the edge fades.
  useEffect(() => {
    const content = rootRef.current;
    const scroller = findScrollParent(content);

    if (content === null || scroller === null) {
      return;
    }

    const measure = () => {
      above$.set(scroller.scrollTop > 1);
      below$.set(scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1);
    };
    const observer = new ResizeObserver(measure);

    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    observer.observe(scroller);
    observer.observe(content);

    return () => {
      scroller.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [above$, below$, isLoaded]);

  // Keep the window summary and accessible name in sync with the note title.
  useEffect(() => {
    if (noteTitle !== undefined && noteTitle.trim().length > 0 && noteTitle !== windowTitle) {
      dispatch({ title: noteTitle, type: "window.setTitle", windowId });
    }
  }, [dispatch, noteTitle, windowId, windowTitle]);

  if (!isLoaded && error === undefined) {
    return <div className={styles.notice()} />;
  }

  if (note == null) {
    return (
      <div className={styles.notice()}>
        <div>
          <p role={error === undefined ? undefined : "alert"}>
            {error?.message ?? "This note no longer exists."}
          </p>
          {error === undefined ? null : (
            <Button
              disabled={isGetting}
              onClick={() => ensureNoteLoaded(noteId, gateway)}
              size="sm"
              variant="ghost"
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root()} ref={rootRef}>
      {/* Inline opacity carries the measured scroll state. */}
      <div className={noteWindow({ edge: "top", overflowing: above }).fade()} />
      <div className={styles.body()}>
        {error === undefined ? null : <p role="alert">{error.message}</p>}
        {/* The title field has a persistent accessible name. */}
        <input
          aria-label="Note title"
          className={styles.title()}
          onChange={(event) => {
            editNote(noteId, { text: note.content.text, title: event.target.value }, gateway);
          }}
          placeholder="Untitled"
          value={note.title}
        />
        {/* Mention clicks open the referenced note. */}
        <div
          className={styles.editor()}
          onClick={(event) => {
            const chip =
              event.target instanceof Element ? event.target.closest("[data-note-id]") : null;
            const mentionedId = chip?.getAttribute("data-note-id") ?? "";
            const item = mentionable.find((candidate) => candidate.id === mentionedId);

            if (item !== undefined) {
              // Legend State unwraps to a mutable structural type.
              void openItemWindow({
                dispatch,
                item,
                state: store.state$.peek() as InfiniteCanvasState<WindowKind>,
              });
            }
          }}
        >
          <NoteEditor
            /* External writes remount Lexical before stale text can overwrite them. */
            key={externalWrites}
            mentions={{
              /* Mentions add relations. Removing mention text does not remove a relation. */
              onSelect: (mentionedId) => {
                void connectItems({ projectId, source: noteId, target: mentionedId });
              },
              // Exclude the current note because self-relations are invalid.
              options: mentionable.filter((candidate) => candidate.id !== noteId),
              portalRoot,
            }}
            onChange={(text) => {
              editNote(noteId, { text, title: note.title }, gateway);
            }}
            value={note.content.text}
          />
        </div>
      </div>
      <div className={noteWindow({ edge: "bottom", overflowing: below }).fade()} />
    </div>
  );
}
