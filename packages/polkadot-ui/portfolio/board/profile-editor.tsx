import { Show, useObservable, useValue } from "@legendapp/state/react";
import { Button, Field, Input, Label, Prose, Row, Stack, Textarea } from "polkadot-ui";
import { useId } from "react";
import { type } from "arktype";

import type { Profile } from "../content/model.ts";
import { changePortfolio } from "../data/mutations.ts";

export function ProfileEditor({ profile, onClose }: Readonly<{
  profile: Profile;
  onClose: () => void;
}>) {
  const summaryId = useId();
  const draft$ = useObservable({
    original: profile,
    name: profile.name,
    role: profile.role,
    summary: profile.summary,
    location: profile.location,
    availability: profile.availability,
    saving: false,
    error: "",
  });
  const draft = useValue(draft$);

  async function save() {
    if (draft$.saving.peek()) return;
    draft$.saving.set(true);
    draft$.error.set("");
    try {
      const values = draft$.peek();
      const result = await changePortfolio({
        operation: "replace",
        id: profile.id,
        expected: values.original,
        widget: {
          ...values.original,
          name: values.name,
          role: values.role,
          summary: values.summary,
          location: values.location,
          availability: values.availability,
        },
      });
      if (result instanceof Error || result instanceof type.errors) {
        draft$.error.set(result instanceof type.errors ? result.summary : result.message);
        return;
      }
      onClose();
    } catch (error) {
      console.warn("The profile could not be saved. The draft is retained.", error);
      draft$.error.set("The profile could not be saved. Your changes are still here. Retry to save.");
    } finally {
      draft$.saving.set(false);
    }
  }

  return (
    <form className="board-profile-editor" aria-label="Edit profile" onKeyDown={(event) => {
      if (event.key !== "Escape" || draft$.saving.peek()) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }} onSubmit={(event) => {
      event.preventDefault();
      void save();
    }}>
      <fieldset disabled={draft.saving}>
      <Stack gap="lg">
        <Row><Label>Edit profile</Label><Button type="button" disabled={draft.saving} onClick={onClose}>Cancel</Button></Row>
        <Field layout="stacked"><Field.Label>Name</Field.Label><Input autoFocus required value={draft.name} onChange={(event) => draft$.name.set(event.target.value)} /></Field>
        <Field layout="stacked"><Field.Label>Role</Field.Label><Input required value={draft.role} onChange={(event) => draft$.role.set(event.target.value)} /></Field>
        <Field layout="stacked"><Field.Label htmlFor={summaryId}>Summary</Field.Label><Textarea id={summaryId} required rows={5} value={draft.summary} onChange={(event) => draft$.summary.set(event.target.value)} /></Field>
        <Field layout="stacked"><Field.Label>Location</Field.Label><Input required value={draft.location} onChange={(event) => draft$.location.set(event.target.value)} /></Field>
        <Field layout="stacked"><Field.Label>Availability</Field.Label><Input required value={draft.availability} onChange={(event) => draft$.availability.set(event.target.value)} /></Field>
        <Show if={draft$.error}><Prose role="alert">{draft.error}</Prose></Show>
        <Button type="submit" disabled={draft.saving} aria-busy={draft.saving}>Save profile</Button>
      </Stack>
      </fieldset>
    </form>
  );
}
