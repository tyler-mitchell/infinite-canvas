import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
  Display,
  IconTile,
  iconTileVariants,
  Kind,
  Label,
  Meta,
  Prose,
  Readout,
  Row,
  rowVariants,
  ScrollArea,
  type ScrollAreaProps,
  Separator,
  separatorVariants,
  Surface,
  surfaceVariants,
  Title,
  Toolbar,
  type ToolbarButtonProps,
  type ToolbarProps,
  tv,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import { COMMITS } from "../fixtures.ts";

const layout = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    pad: "flex flex-wrap items-start gap-3",
    padBox: "w-[176px]",
    inline: "flex flex-wrap items-center gap-3",
    tiles: "flex flex-wrap items-center gap-2",
    rails: "flex items-start gap-4",
    monogram:
      "flex size-full items-center justify-center rounded-[5px] bg-pk-surface-inner font-pk-mono text-[10px] leading-none text-pk-ink-soft",
    scrollers: "flex flex-wrap items-start gap-3",
    scroller: "h-[104px] w-[400px]",
    scrollBody: "flex flex-col gap-2",
    /* Held on one line so the content is wider than the frame, which is what gives it a second bar. */
    scrollBodyWide: "flex w-max flex-col gap-2 whitespace-nowrap",
    scrollWide: "h-[104px] w-[230px]",
  },
});

const PADDING = ["tight", "snug", "default", "roomy"] as const;

const STACK = [
  ["TS", "TypeScript"],
  ["RE", "React"],
  ["WG", "WebGPU"],
  ["RS", "Rust"],
  ["SD", "SurrealDB"],
] as const;

export const Route = createFileRoute("/layout")({
  component: Layout,
});

function Layout() {
  const styles = layout();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>layout</Display>
        <Prose className={styles.lede()}>
          The frame and the line. Surface owns tone, padding, radius and lift; Row owns a two-end
          line. Neither has an opinion about what goes inside it.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>surface</Kind>
          <Meta>7 tones · 5 paddings</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>card</Label>
              <Meta>default</Meta>
            </Row>
            <Prose>A hairline, a near-black fill and a long soft shadow.</Prose>
          </Surface>
          <Surface tone="sunken">
            <Row>
              <Label>sunken</Label>
              <Meta>inset lift</Meta>
            </Row>
            <Prose>Set into the board rather than resting on it.</Prose>
          </Surface>
          <Surface tone="deep">
            <Row>
              <Label>deep</Label>
            </Row>
            <Prose>A darker fill, for a layer that sits behind the others.</Prose>
          </Surface>
          <Surface tone="tile">
            <Row>
              <Label>tile</Label>
            </Row>
            <Prose>The rim at a different phase, so it reads as another material.</Prose>
          </Surface>
          <Surface tone="rim" padding="roomy">
            <Row>
              <Label>rim</Label>
              <Meta>hover</Meta>
            </Row>
            <Prose>A specular conic edge that sweeps while the pointer is over it.</Prose>
          </Surface>
          <Surface tone="pending">
            <Row>
              <Label>pending</Label>
            </Row>
            <Prose>A dashed edge says unbuilt. It must not read as a finished card.</Prose>
          </Surface>
          <Surface tone="bare">
            <Row>
              <Label>bare</Label>
            </Row>
            <Prose>No frame at all, for a widget that brings its own.</Prose>
          </Surface>
        </div>
        <Api name="surface" of={surfaceVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>padding</Kind>
          <Meta>tight → roomy, with the gap scaled to match</Meta>
        </Row>
        <div className={styles.pad()}>
          {PADDING.map((padding) => (
            <Surface key={padding} tone="card" padding={padding} className={styles.padBox()}>
              <Row>
                <Label>{padding}</Label>
              </Row>
              <Meta>gap follows padding</Meta>
            </Surface>
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>row</Kind>
          <Meta>3 alignments · 3 justifies · a rule above or below</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>baseline</Label>
              <Readout>8.2 ms</Readout>
            </Row>
            <Prose>The default: two ends on one line.</Prose>
            <Row rule="above">
              <Meta>82 lines · wgsl</Meta>
              <Meta>@jane</Meta>
            </Row>
          </Surface>
          <Surface tone="card">
            <Row rule="below">
              <Kind>gist</Kind>
              <Meta>04</Meta>
            </Row>
            <Title>field-shader.wgsl</Title>
            <Prose>A rule below opens a widget; a rule above closes one.</Prose>
          </Surface>
          <Surface tone="card">
            <Row justify="start">
              <Kind>start</Kind>
              <Meta>both ends together</Meta>
            </Row>
            <Row justify="end">
              <Kind>end</Kind>
              <Meta>pushed to the far side</Meta>
            </Row>
            <Prose>Between is the default, and the other two gather the line at one end.</Prose>
          </Surface>
        </div>
        <Api name="row" of={rowVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>icon tile</Kind>
          <Meta>point at one · the label unfurls</Meta>
        </Row>
        <div className={styles.tiles()}>
          {STACK.map(([mark, name]) => (
            <IconTile
              key={name}
              label={name}
              icon={<span className={styles.monogram()}>{mark}</span>}
            />
          ))}
          <IconTile open label="held open" icon={<span className={styles.monogram()}>ON</span>} />
        </div>
        <Api name="icon tile" of={iconTileVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>separator</Kind>
          <Meta>vertical stretches to the line it divides</Meta>
        </Row>
        <div className={styles.inline()}>
          <Meta>edge</Meta>
          <Separator orientation="vertical" />
          <Meta>snap on</Meta>
          <Separator orientation="vertical" />
          <Meta>42 ms</Meta>
        </div>
        <Api name="separator" of={separatorVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>scroll area</Kind>
          <Meta>an overlay scrollbar that does not take width</Meta>
        </Row>
        <div className={styles.scrollers()}>
          <Surface tone="card" className={styles.scroller()}>
            <ScrollArea>
              <div className={styles.scrollBody()}>
                {COMMITS.map((commit) => (
                  <Meta key={commit}>{commit}</Meta>
                ))}
              </div>
            </ScrollArea>
          </Surface>

          <Surface tone="card" className={styles.scrollWide()}>
            <ScrollArea axis="both">
              <div className={styles.scrollBodyWide()}>
                {COMMITS.map((commit) => (
                  <Meta key={commit}>{commit}</Meta>
                ))}
              </div>
            </ScrollArea>
          </Surface>
        </div>
        <Props<ScrollAreaProps>
          name="scroll area"
          rows={[
            {
              name: "axis",
              values: ["horizontal", "both"],
              fallback: "vertical",
              note: "which axes get a bar; a widget body usually wants only the one",
            },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>toolbar</Kind>
          <Meta>one tab stop, arrows move between buttons</Meta>
        </Row>
        <div className={styles.rails()}>
          <Toolbar>
            <Toolbar.Group>
              <Toolbar.Button render={<Button tone="ghost" size="icon" />}>−</Toolbar.Button>
              <Toolbar.Button render={<Button tone="ghost" size="sm" />}>100%</Toolbar.Button>
              <Toolbar.Button render={<Button tone="ghost" size="icon" />}>+</Toolbar.Button>
            </Toolbar.Group>
            <Toolbar.Separator />
            <Toolbar.Group>
              <Toolbar.Button render={<Button tone="ghost" size="sm" />}>fit</Toolbar.Button>
              <Toolbar.Button render={<Button tone="ghost" size="sm" />}>group</Toolbar.Button>
              {/* Disabled, and still reached by the arrows, which is what focusableWhenDisabled means. */}
              <Toolbar.Button disabled render={<Button tone="ghost" size="sm" />}>
                merge
              </Toolbar.Button>
            </Toolbar.Group>
          </Toolbar>

          <Toolbar orientation="vertical">
            <Toolbar.Group>
              <Toolbar.Button render={<Button tone="ghost" size="icon" />}>−</Toolbar.Button>
              <Toolbar.Button render={<Button tone="ghost" size="icon" />}>+</Toolbar.Button>
            </Toolbar.Group>
            <Toolbar.Separator />
            <Toolbar.Group>
              <Toolbar.Button render={<Button tone="ghost" size="icon" />}>◇</Toolbar.Button>
            </Toolbar.Group>
          </Toolbar>
        </div>
        <Props<ToolbarProps>
          name="toolbar"
          rows={[
            {
              name: "orientation",
              values: ["vertical"],
              fallback: "horizontal",
              note: "which arrow keys move between the buttons",
            },
            {
              name: "loopFocus",
              fallback: "true",
              note: "whether the arrows wrap from the last button to the first",
            },
            { name: "disabled", note: "closes the whole rail to interaction" },
          ]}
        />
        <Props<ToolbarButtonProps>
          name="toolbar button"
          rows={[
            { name: "disabled", fallback: "false", note: "the button stops responding" },
            {
              name: "focusableWhenDisabled",
              fallback: "true",
              note: "a disabled button still takes the arrow keys, so it can say why it is off",
            },
          ]}
        />
      </section>
    </div>
  );
}
