import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Button,
  buttonVariants,
  Checkbox,
  checkboxVariants,
  Display,
  Field,
  type FieldProps,
  fieldVariants,
  Input,
  inputVariants,
  Kind,
  Label,
  Meta,
  Prose,
  Radio,
  RadioGroup,
  radioVariants,
  Readout,
  Row,
  Select,
  selectVariants,
  Slider,
  type SliderProps,
  Surface,
  Switch,
  ToggleGroup,
  toggleGroupVariants,
  tv,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import { CATEGORIES, EXPORT_AS, RULERS, SNAP } from "../fixtures.ts";

const controls = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    matrix: "flex flex-col gap-3",
    matrixRow: "flex items-center gap-3",
    /* The buttons wrap inside their own box, so a wrapped one lands under a button and not
     * under the tone that names the row. */
    matrixButtons: "flex min-w-0 flex-1 flex-wrap items-center gap-3",
    tone: "w-[68px] flex-none",
    inline: "flex flex-wrap items-center gap-4",
    pair: "flex items-center gap-2.5",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    sliders: "grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3",
    upright: "w-[196px]",
  },
});

const TONES = ["solid", "soft", "outline", "ghost"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const RANGES = ["3m", "6m", "max"];
const SIZE_LABEL = { sm: "clone", md: "print", lg: "arrange" } as const;

export const Route = createFileRoute("/controls")({
  component: Controls,
});

function Controls() {
  const styles = controls();
  const [categories, setCategories] = useState<string[]>([]);
  const [range, setRange] = useState<string[]>(["3m"]);
  const [sound, setSound] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [snap, setSnap] = useState<string>("edges");
  const [canvas, setCanvas] = useState("field notes");
  const [format, setFormat] = useState<string>("svg");

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>controls</Display>
        <Prose className={styles.lede()}>
          Every control is a Base UI primitive with tailwind-variants slots over it. State comes
          from the primitive, so a variant is selected by the state Base UI hands to className
          rather than by an attribute selector.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>button</Kind>
          <Meta>4 tones × 3 sizes · plus icon</Meta>
        </Row>
        <div className={styles.matrix()}>
          {TONES.map((tone) => (
            <div key={tone} className={styles.matrixRow()}>
              <Label className={styles.tone()}>{tone}</Label>
              <div className={styles.matrixButtons()}>
                {SIZES.map((size) => (
                  <Button key={size} tone={tone} size={size}>
                    {SIZE_LABEL[size]}
                  </Button>
                ))}
                <Button tone={tone} size="icon">
                  +
                </Button>
                <Button tone={tone} disabled>
                  disabled
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Api name="button" of={buttonVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>toggle group</Kind>
          <Meta>one recessed track · pick one</Meta>
        </Row>
        <ToggleGroup value={range} onValueChange={setRange}>
          {RANGES.map((span) => (
            <ToggleGroup.Item key={span} value={span}>
              {span}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>

        <Row rule="below">
          <Kind>toggle group · chips</Kind>
          <Meta>multiple · the accent is the pressed state</Meta>
        </Row>
        <ToggleGroup look="chips" multiple value={categories} onValueChange={setCategories}>
          {CATEGORIES.map((category) => (
            <ToggleGroup.Item key={category} value={category}>
              {category}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
        <Meta>
          {categories.length === 0 ? "nothing filtered" : `filtering ${categories.join(" · ")}`}
        </Meta>
        <Row rule="below">
          <Kind>toggle group · vertical</Kind>
          <Meta>the same value, stacked · either row moves both</Meta>
        </Row>
        <ToggleGroup
          look="chips"
          multiple
          orientation="vertical"
          value={categories}
          onValueChange={setCategories}
        >
          {CATEGORIES.map((category) => (
            <ToggleGroup.Item key={category} value={category}>
              {category}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
        <Api name="toggle group" of={toggleGroupVariants} except={["pressed"]} />
      </section>

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
          It is a third state rather than a style, so it says <Readout>mixed</Readout> to a reader
          who cannot see the dash, and clicking it settles the whole group one way.
        </Prose>
        <Api name="checkbox" of={checkboxVariants} except={["checked"]} />
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
          <Readout>Field</Readout> whose label names it. One disabled option stays in the group and
          out of the arrow keys, which is what a radio group does rather than what it is told.
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
                <Button size="md">open</Button>
              </div>
            </Field>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          A placeholder is not a name. It goes the moment anything is typed, and a reader who cannot
          see the field hears nothing at all — so every one of these sits in a{" "}
          <Readout>Field</Readout> whose label stays.
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
          that turns over, a tick beside the chosen row, and the same <Readout>Field</Readout> that
          names every other control on this page.
        </Prose>
        <Api name="select" of={selectVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>slider</Kind>
          <Meta>labelled track with a mono readout</Meta>
        </Row>
        <div className={styles.sliders()}>
          <Surface tone="card">
            <Slider label="intensity" defaultValue={40} />
          </Surface>
          <Surface tone="card">
            <Slider label="zoom" defaultValue={8} min={1} max={64} />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>bare track</Label>
            </Row>
            <Slider aria-label="bare track" defaultValue={62} showValue={false} />
          </Surface>
          <Surface tone="card">
            <Slider label="range" defaultValue={[24, 68]} />
          </Surface>
        </div>

        <Row rule="below">
          <Kind>slider · vertical</Kind>
          <Meta>the same track, stood on end</Meta>
        </Row>
        <Surface tone="card" className={styles.upright()}>
          <Slider label="gain" defaultValue={55} orientation="vertical" />
        </Surface>
        <Props<SliderProps>
          name="slider"
          rows={[
            { name: "label", note: "names the track, and draws above it" },
            { name: "aria-label", note: "names a track that draws no label; one or the other" },
            { name: "showValue", fallback: "true", note: "the mono readout beside the label" },
            { name: "defaultValue", note: "one number, or two for a range" },
            { name: "min", fallback: "0" },
            { name: "max", fallback: "100" },
            { name: "orientation", fallback: "horizontal", values: ["vertical"] },
          ]}
        />
      </section>
    </div>
  );
}
