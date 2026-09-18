import { Show, useObservable } from "@legendapp/state/react";
import type { Observable } from "@legendapp/state";
import { createContext, use, useId, type ComponentProps, type ReactNode } from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { Button, type ButtonProps } from "./button.tsx";
import { Textarea, type TextareaProps } from "./textarea.tsx";
import { Prose } from "./text.tsx";
import { tv } from "../tv.ts";

export type EditableNoteProps = Readonly<{
  text: string;
  onTextChange: (text: string) => void;
  children: ReactNode;
}>;
const Context = createContext<
  (EditableNoteProps & { editing$: Observable<boolean>; textId: string }) | null
>(null);
const editableNote = tv({ slots: { trigger: "", preview: "whitespace-pre-wrap", editor: "" } });

function useNote() {
  const value = use(Context);
  if (value === null) throw new Error("Editable note parts require their Root.");
  return value;
}

function EditableNote(props: EditableNoteProps) {
  const editing$ = useObservable(false);
  const textId = useId();
  return <Context value={{ ...props, editing$, textId }}>{props.children}</Context>;
}

export type EditableNoteTriggerProps = ButtonProps;
function EditableNoteTrigger({ className, ...props }: EditableNoteTriggerProps) {
  const { editing$, textId } = useNote();
  return (
    <Button
      tone="ghost"
      size="sm"
      data-slot="editable-note-trigger"
      className={editableNote().trigger({ className })}
      {...mergeProps<typeof Button>(
        {
          "aria-controls": textId,
          onClick: () => editing$.set(!editing$.peek()),
          children: (
            <Show if={editing$} else="Edit">
              Done
            </Show>
          ),
        },
        props,
      )}
    />
  );
}

export type EditableNotePreviewProps = ComponentProps<typeof Prose>;
function EditableNotePreview({ className, ...props }: EditableNotePreviewProps) {
  const { editing$, text, textId } = useNote();
  return (
    <Show if={() => !editing$.get()}>
      <Prose
        {...props}
        data-slot="editable-note-preview"
        className={editableNote().preview({ className })}
        id={textId}
      >
        {text}
      </Prose>
    </Show>
  );
}

export type EditableNoteEditorProps = TextareaProps;
function EditableNoteEditor({ className, ...props }: EditableNoteEditorProps) {
  const { editing$, text, textId, onTextChange } = useNote();
  return (
    <Show if={editing$}>
      <Textarea
        {...mergeProps<"textarea">(
          {
            autoFocus: true,
            rows: 6,
            id: textId,
            value: text,
            className: editableNote().editor({ className }),
            onChange: (event) => onTextChange(event.target.value),
          },
          props,
        )}
        data-slot="editable-note-editor"
      />
    </Show>
  );
}

EditableNote.Trigger = EditableNoteTrigger;
EditableNote.Preview = EditableNotePreview;
EditableNote.Editor = EditableNoteEditor;
export {
  EditableNote,
  EditableNoteTrigger,
  EditableNotePreview,
  EditableNoteEditor,
  editableNote as editableNoteVariants,
};
