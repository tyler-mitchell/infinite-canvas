import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  Checkbox,
  Code,
  Combobox,
  Display,
  Field,
  type FieldProps,
  fieldVariants,
  Input,
  inputVariants,
  Kind,
  Meta,
  NumberField,
  Prose,
  Radio,
  RadioGroup,
  radioVariants,
  Row,
  Select,
  Surface,
  Switch,
  tv,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import { COMMANDS, EXPORT_AS, GEOMETRY, RULERS, SNAP } from "../fixtures.ts";

const forms = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    inline: "flex flex-wrap items-center gap-4",
    pair: "flex items-center gap-2.5",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(min(236px,100%),1fr))] gap-3",
    geometry: "grid grid-cols-[repeat(auto-fill,minmax(min(128px,100%),1fr))] gap-3",
    board: "max-w-[600px]",
  },
});

export const Route = createFileRoute("/forms")({
  component: Forms,
});

function Forms() {
  const styles = forms();
  const [sound, setSound] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [snap, setSnap] = useState<string>("edges");
  const [canvas, setCanvas] = useState("field notes");
  const [format, setFormat] = useState<string>("svg");

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>forms</Display>
        <Prose className={styles.lede()}>
          Every one of these takes its name from the <Code>Field</Code> around it rather than from a
          prop of its own, so a reader who cannot see the control still hears what it is for. The
          last four are one control drawn four ways: the input's look, laid on rather than copied.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>switch</Kind>
          <Meta>the thumb travels the track less its own width</Meta>
        </Row>
        <div className={styles.inline()}>
          <Field>
            <Switch checked={sound} onCheckedChange={setSound} />
            <Field.Label>sound</Field.Label>
          </Field>
          <Field>
            <Switch defaultChecked />
            <Field.Label>on</Field.Label>
          </Field>
          <Field>
            <Switch />
            <Field.Label>off</Field.Label>
          </Field>
          <Field disabled>
            <Switch />
            <Field.Label>disabled</Field.Label>
          </Field>
        </div>
        <Props<FieldProps>
          name="field"
          rows={[
            {
              name: "disabled",
              fallback: "false",
              note: "disables the control it wraps, and takes precedence over the control's own",
            },
          ]}
        />
        <Api name="field" of={fieldVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>checkbox</Kind>
          <Meta>ticked, mixed, and neither</Meta>
        </Row>
        <div className={styles.inline()}>
          <Field>
            <Checkbox checked={wrap} onCheckedChange={setWrap} />
            <Field.Label>wrap</Field.Label>
          </Field>
          <Field>
            <Checkbox defaultChecked />
            <Field.Label>ticked</Field.Label>
          </Field>
          <Field>
            <Checkbox indeterminate />
            <Field.Label>mixed</Field.Label>
          </Field>
          <Field disabled>
            <Checkbox defaultChecked />
            <Field.Label>disabled</Field.Label>
          </Field>
        </div>
        <Prose className={styles.lede()}>
          The mixed state is the parent of a group where some children are ticked and some are not.
          It is a third state rather than a style, so it says <Code>mixed</Code> to a reader who
          cannot see the dash, and clicking it settles the whole group one way.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>radio group</Kind>
          <Meta>one of several · the group carries the name</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>snap to</Field.Label>
              <RadioGroup value={snap} onValueChange={(next) => setSnap(String(next))}>
                {SNAP.map((option) => (
                  <Field key={option}>
                    <Radio value={option} />
                    <Field.Label>{option}</Field.Label>
                  </Field>
                ))}
              </RadioGroup>
            </Field>
          </Surface>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>ruler</Field.Label>
              <RadioGroup layout="inline" defaultValue="px">
                {RULERS.map((option) => (
                  <Field key={option}>
                    <Radio value={option} disabled={option === "pt"} />
                    <Field.Label>{option}</Field.Label>
                  </Field>
                ))}
              </RadioGroup>
            </Field>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          The group is the thing a reader hears named, not each button, so it sits inside a stacked{" "}
          <Code>Field</Code> whose label names it. One disabled option stays in the group and out of
          the arrow keys, which is what a radio group does rather than what it is told.
        </Prose>
        <Api name="radio" of={radioVariants} except={["checked"]} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>input</Kind>
          <Meta>a medium button's height, so the two line up</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>canvas name</Field.Label>
              <Input value={canvas} onValueChange={(next) => setCanvas(String(next))} />
            </Field>
          </Surface>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>find</Field.Label>
              <Input tone="outline" placeholder="a window, a group, a note" />
            </Field>
          </Surface>
          <Surface tone="card">
            <Field layout="stacked" disabled>
              <Field.Label>workspace</Field.Label>
              <div className={styles.pair()}>
                <Input defaultValue="infinite-canvas" />
                <Button size="md" disabled>
                  open
                </Button>
              </div>
            </Field>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          A placeholder is not a name. It goes the moment anything is typed, and a reader who cannot
          see the field hears nothing at all — so every one of these sits in a <Code>Field</Code>{" "}
          whose label stays.
        </Prose>
        <Api name="input" of={inputVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>select</Kind>
          <Meta>the trigger is an input · the list is the menu's popup</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>export as</Field.Label>
              <Select value={format} onValueChange={(next) => setFormat(String(next))}>
                <Select.Trigger />
                <Select.Content>
                  {EXPORT_AS.map((option) => (
                    <Select.Item key={option} value={option}>
                      {option}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </Surface>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>ruler</Field.Label>
              <Select>
                <Select.Trigger tone="outline" placeholder="pick a unit" />
                <Select.Content>
                  {RULERS.map((option) => (
                    <Select.Item key={option} value={option} disabled={option === "pt"}>
                      {option}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          The trigger is the input's own look, laid on rather than copied, so the two cannot drift
          apart. The list is the menu's popup for the same reason. What is left here is a chevron
          that turns over, a tick beside the chosen row, and the same <Code>Field</Code> that names
          every other control on this page.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>combobox</Kind>
          <Meta>a list narrowed by typing · the field is the input again</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Field layout="stacked">
              <Field.Label>go to</Field.Label>
              <Combobox items={COMMANDS}>
                <Combobox.Input placeholder="a window, a group, a note" />
                <Combobox.Content>
                  <Combobox.Empty>nothing by that name</Combobox.Empty>
                  <Combobox.List>
                    {(command: string) => (
                      <Combobox.Item key={command} value={command}>
                        {command}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Content>
              </Combobox>
            </Field>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          Type to narrow, and the list says <Code>nothing by that name</Code> when the query matches
          none of them, rather than closing on an empty box. The field is the form control, so the{" "}
          <Code>Field</Code> label names it, the same as everything above.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>number field</Kind>
          <Meta>a step either side · drag the label</Meta>
        </Row>
        <Surface tone="card" className={styles.board()}>
          <div className={styles.geometry()}>
            {GEOMETRY.map(([name, value, unit]) => (
              <Field key={name} layout="stacked">
                <NumberField defaultValue={value} min={0} max={4096}>
                  <NumberField.Scrub>
                    <Field.Label>{`${name} ${unit}`}</Field.Label>
                  </NumberField.Scrub>
                  <NumberField.Group />
                </NumberField>
              </Field>
            ))}
          </div>
        </Surface>
        <Prose className={styles.lede()}>
          The label is a handle. Dragging it sideways changes the number, which is how a canvas asks
          for a width without anyone typing one, and the pointer is replaced while the drag lasts so
          the cursor does not run off the edge of the screen. Typing still works, and so do the two
          steps.
        </Prose>
      </section>
    </div>
  );
}
