import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import {
  Button,
  buttonVariants,
  Kind,
  Label,
  Meta,
  Prose,
  Row,
  Slider,
  Surface,
  Switch,
  Title,
  ToggleGroup,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { CATEGORIES } from "../fixtures.ts";

const controls = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    matrix: "flex flex-col gap-3",
    matrixRow: "flex flex-wrap items-center gap-3",
    tone: "w-[68px]",
    inline: "flex flex-wrap items-center gap-4",
    pair: "flex items-center gap-[10px]",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
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

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Title>controls</Title>
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
          ))}
        </div>
        <Api of={buttonVariants} />
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
        {/* The same chips stacked, which is what a filter rail down a side needs. */}
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
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>switch</Kind>
          <Meta>the thumb travels the track less its own width</Meta>
        </Row>
        <div className={styles.inline()}>
          <div className={styles.pair()}>
            <Switch checked={sound} onCheckedChange={setSound} />
            <Label>sound</Label>
          </div>
          <div className={styles.pair()}>
            <Switch defaultChecked />
            <Label>on</Label>
          </div>
          <div className={styles.pair()}>
            <Switch />
            <Label>off</Label>
          </div>
          <div className={styles.pair()}>
            <Switch disabled />
            <Label>disabled</Label>
          </div>
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>slider</Kind>
          <Meta>labelled track with a mono readout</Meta>
        </Row>
        <div className={styles.grid()}>
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
            <Slider defaultValue={62} showValue={false} />
          </Surface>
          <Surface tone="card">
            {/* Two values: Base UI wants one thumb per entry, each carrying its own index. */}
            <Slider label="range" defaultValue={[24, 68]} />
          </Surface>
          <Surface tone="card">
            {/* Vertical is a Root prop, so the kit's track has to turn with it. */}
            <Slider label="gain" defaultValue={55} orientation="vertical" />
          </Surface>
        </div>
      </section>
    </div>
  );
}
