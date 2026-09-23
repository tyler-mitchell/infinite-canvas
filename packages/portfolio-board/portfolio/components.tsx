import { For, Show, useComputed } from "@legendapp/state/react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useState } from "react";
import {
  ActivityGrid,
  Avatar,
  Badge,
  Card,
  Checkbox,
  ContainerTransform,
  Display,
  EditableNote,
  Kind,
  Label,
  Link,
  Meta,
  NestedUnfold,
  Printer,
  Prose,
  Receipt,
  Row,
  Separator,
  Sparkline,
  Stack,
  Stat,
  StatusDot,
  Surface,
  ShaderSurface,
  halftone,
  waveTube,
  type WaveTubeOptions,
  Title,
  Tooltip,
  tv,
} from "portfolio-board";

import { ExpandInPlace } from "../src/components/motion/expand-in-place.tsx";
import { defineComponents } from "@hyphened/infinite-canvas/next/react";
import { type } from "arktype";
import codexSprite from "./codex.webp";
import npm from "./npm.svg";
import { CareerCard, careerEntry } from "./career.tsx";
import {
  siClaudecode,
  siCplusplus,
  siEffect,
  siGithub,
  siJavascript,
  siModelcontextprotocol,
  siNodedotjs,
  siNpm,
  siPnpm,
  siPython,
  siReact,
  siRust,
  siSurrealdb,
  siTailwindcss,
  siTanstack,
  siThreedotjs,
  siTurborepo,
  siTypescript,
  siVite,
  siVitest,
  siWebgpu,
  siZod,
} from "simple-icons";

const styles = tv({
  slots: {
    tile: "pk-rim-tile rounded-pk-inner p-[18%]",
    icon: "block aspect-square h-auto w-full",
    note: "border-s-2",
  },
});

const icons = {
  typescript: siTypescript,
  javascript: siJavascript,
  react: siReact,
  github: siGithub,
  python: siPython,
  rust: { ...siRust, hex: "DEA584" },
  cplusplus: siCplusplus,
  nodedotjs: siNodedotjs,
  pnpm: siPnpm,
  vite: siVite,
  vitest: siVitest,
  tailwindcss: siTailwindcss,
  zod: siZod,
  effect: siEffect,
  tanstack: siTanstack,
  turborepo: siTurborepo,
  threedotjs: siThreedotjs,
  webgpu: siWebgpu,
  surrealdb: siSurrealdb,
  modelcontextprotocol: siModelcontextprotocol,
  claudecode: siClaudecode,
  codex: {
    title: "Codex",
    hex: "7A9DFF",
    image: codexSprite,
  },
} satisfies Record<
  string,
  {
    title: string;
    hex: string;
  } & ({ path: string } | { image: string })
>;

const link = type({ label: "string > 0", href: type("string.url").and(/^https:\/\//) });
const section = type({ title: "string > 0", body: "string > 0" });
const user = type({
  name: "string | null",
  login: "string > 0",
  location: "string | null",
  url: "string.url",
  avatarUrl: "string.url",
  createdAt: "string.date.iso",
  status: type({ message: "string | null" }).or("null"),
  followers: { totalCount: "number.integer >= 0" },
  following: { totalCount: "number.integer >= 0" },
  repositories: { totalCount: "number.integer >= 0" },
  socialAccounts: { nodes: type({ displayName: "string > 0", url: "string.url" }).array() },
});
const project = type({
  title: "string > 0",
  period: "string > 0",
  visibility: "'Open source' | 'Private'",
  summary: "string > 0",
  sections: section.array(),
  tags: "string[]",
  links: link.array(),
});
const experience = type({
  organization: "string > 0",
  role: "string > 0",
  period: "string > 0",
  summary: "string > 0",
  details: "string[]",
  tags: "string[]",
});
const expertise = type({
  title: "string > 0",
  groups: type({ title: "string > 0", items: "string[]" }).array(),
});
const education = type({
  degree: "string > 0",
  institution: "string > 0",
  period: "string > 0",
});
const contact = type({
  title: "string > 0",
  email: "string.email",
  links: link.array(),
});
const quartiles = [
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
] as const;
const contributionCalendar = type({
  totalContributions: "number.integer >= 0",
  weeks: type({
    contributionDays: type({
      date: "string.date.iso",
      contributionCount: "number.integer >= 0",
      contributionLevel: type.enumerated("NONE", ...quartiles),
    }).array(),
  }).array(),
});

function ContributionsCard({
  calendar,
  onContentHeightChange,
}: {
  calendar: typeof contributionCalendar.infer;
  onContentHeightChange?: (height: number) => void;
}) {
  const [replayKey, setReplayKey] = useState(0);
  return (
    <Card.Body
      className="cursor-pointer"
      onContentHeightChange={onContentHeightChange}
      onClick={() => setReplayKey((current) => current + 1)}
    >
      <Card.Header>
        <Kind>Contributions</Kind>
        <Meta>{calendar.totalContributions.toLocaleString()} this year</Meta>
      </Card.Header>
      <Card.Content>
        <ActivityGrid
          render={<ButtonPrimitive nativeButton={false} render={<div />} />}
          role="button"
          aria-label="Contributions. Activate to replay animation."
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space"
          label="contributions"
          replayKey={replayKey}
          onClick={(event) => {
            event.stopPropagation();
            setReplayKey((current) => current + 1);
          }}
          weeks={calendar.weeks.length}
          days={calendar.weeks.flatMap((week) =>
            week.contributionDays.map((day) => ({
              date: new Date(`${day.date}T00:00`),
              count: day.contributionCount,
            })),
          )}
          thresholds={[1, 5, 12, 25]}
          playback={{ waitForPageLoad: true, startDelay: 0.8 }}
        />
      </Card.Content>
    </Card.Body>
  );
}
const repository = type({
  name: "string > 0",
  description: "string | null",
  url: "string.url",
  "npmUrl?": "string.url",
  isPrivate: "boolean",
  topics: type("string > 0")
    .array()
    .default(() => []),
  owner: { login: "string > 0" },
});
type Repository = typeof repository.infer;
type Project = typeof project.infer;
type Experience = typeof experience.infer;
type Expertise = typeof expertise.infer;
type User = typeof user.infer;
type Education = typeof education.infer;
type Contact = typeof contact.infer;

type ContentMotionProps = Readonly<{
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onContentHeightChange?: (height: number) => void;
}>;

function Tags({ items }: Readonly<{ items: string[] }>) {
  const items$ = useComputed(() => items, [items]);
  return (
    <Row justify="start" gap="sm">
      <For each={items$}>{(item$) => <Badge tone="outline">{item$.get()}</Badge>}</For>
    </Row>
  );
}

function Links({ links }: Readonly<{ links: Contact["links"] }>) {
  const links$ = useComputed(() => links, [links]);
  return (
    <Row justify="start" gap="lg">
      <For each={links$}>
        {(link$) => <Link href={link$.href.get()}>{link$.label.get()} ↗</Link>}
      </For>
    </Row>
  );
}

const flowOptions: WaveTubeOptions = {
  anchor: null,
  range: [-12, 6],
  wavelength: 3,
  radius: 0.2175,
  bendAngle: 1.1375,
  scale: 0.4125,
  cameraDistance: 9.125,
  rotation: -0.335,
  tilt: 1.05,
  elevation: 0.81,
  phase: 0.32333333333333336,
  offset: [-0.0125, -0.0875],
  align: "right",
  speed: 1 / 2.1,
  ambient: 1,
  diffuse: 0.03,
  specular: 0,
  gradientRange: [-2.611, 4.849],
  segments: 288,
};

const flowShader = waveTube({
  ...flowOptions,
  colors: ["#96729c", "#ff5d85", "#f7bfc2"],
});

const avatarShader = waveTube({
  ...flowOptions,
  gradientSpeed: 0.08,
  ambient: 0.82,
  diffuse: 0.2,
  specular: 0.18,
  colors: ["#ff00bd", "#9b38ff", "#395bff", "#00eaff", "#00f5aa", "#d4ff36", "#ff9c26", "#ff3186"],
});
const avatarEffect = halftone({ scale: 0.9, strength: 0.9 });
const avatarPresets = {
  spectrum: { shader: avatarShader, effect: avatarEffect, className: "avatar-depth" },
  iridescent: {
    shader: waveTube({
      ...flowOptions,
      specular: 0.9,
      shininess: 180,
      speed: 0.28,
      iridescence: { strength: 2.4, thickness: [180, 900], ior: 1.33 },
    }),
    effect: undefined,
    className: "avatar-iridescent",
  },
};
const avatarPreset = avatarPresets.spectrum;

function ProfileCard({
  user,
  about,
  onContentHeightChange,
}: Readonly<{ user: User; about: string; onContentHeightChange?: (height: number) => void }>) {
  const name = user.name ?? user.login;
  return (
    <Card.Body className="bg-pk-void" onContentHeightChange={onContentHeightChange}>
      <Card.Content>
        <Row justify="start" gap="lg">
          <Avatar
            size="lg"
            className={avatarPreset.className}
            name={name}
            src={user.avatarUrl}
            background={
              <ShaderSurface
                shader={avatarPreset.shader.source}
                geometry={avatarPreset.shader.geometry}
                effect={avatarPreset.effect}
                renderScale={avatarPreset.shader.renderScale}
                resolution={{ width: 256, height: 256 }}
                className="block size-full"
              />
            }
          />
          <Stack gap="xs">
            <Display fluid>{name}</Display>
            <Meta>
              {[
                `@${user.login}`,
                user.location,
                `On GitHub since ${new Date(user.createdAt).getFullYear()}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Meta>
          </Stack>
        </Row>
        {about ? (
          <Prose className="pr-[clamp(16px,8cqi,96px)] text-[16px] leading-relaxed">{about}</Prose>
        ) : null}
        <Row justify="start" gap="xl">
          <Stat value={user.repositories.totalCount} label="repositories" />
          <Stat value={user.followers.totalCount} label="followers" />
          <Stat value={user.following.totalCount} label="following" />
        </Row>
      </Card.Content>
      <Card.Footer rule="above" ruleLook="engraved">
        {user.status?.message ? <StatusDot>{user.status.message}</StatusDot> : null}
        {user.socialAccounts.nodes.map((account) => (
          <Link key={account.url} href={account.url}>
            {account.displayName} ↗
          </Link>
        ))}
        <Link href={user.url}>GitHub ↗</Link>
      </Card.Footer>
    </Card.Body>
  );
}

function ProjectCard({
  project,
  expanded,
  onExpandedChange,
  onContentHeightChange,
}: Readonly<{ project: Project }> & ContentMotionProps) {
  const sections$ = useComputed(() => project.sections, [project.sections]);
  return (
    <ExpandInPlace.Root open={expanded} onOpenChange={onExpandedChange}>
      <Card.Body onContentHeightChange={onContentHeightChange}>
        <Card.Header>
          <Kind>Project</Kind>
          <Meta>{project.period}</Meta>
        </Card.Header>
        <Card.Content>
          <Title>{project.title}</Title>
          <Prose>{project.summary}</Prose>
          <Tags items={project.tags} />
          <Show if={() => project.sections.length > 0}>
            <ExpandInPlace.Trigger>Details</ExpandInPlace.Trigger>
            <ExpandInPlace.Viewport>
              <Separator look="engraved" />
              <Stack gap="lg">
                <For each={sections$}>
                  {(section$) => (
                    <Stack gap="sm">
                      <Kind>{section$.title.get()}</Kind>
                      <Prose>{section$.body.get()}</Prose>
                    </Stack>
                  )}
                </For>
              </Stack>
            </ExpandInPlace.Viewport>
          </Show>
        </Card.Content>
        <Card.Footer rule="above" ruleLook="engraved">
          <Meta>{project.visibility}</Meta>
          <Links links={project.links} />
        </Card.Footer>
      </Card.Body>
    </ExpandInPlace.Root>
  );
}

function ExperienceCard({
  experience,
  expanded,
  onExpandedChange,
  onContentHeightChange,
}: Readonly<{ experience: Experience }> & ContentMotionProps) {
  const details$ = useComputed(() => experience.details, [experience.details]);
  return (
    <ContainerTransform.Root open={expanded} onOpenChange={onExpandedChange}>
      <Card.Body onContentHeightChange={onContentHeightChange}>
        <Card.Header>
          <Kind>Experience</Kind>
          <Meta>{experience.period}</Meta>
        </Card.Header>
        <Card.Content>
          <ContainerTransform.Trigger>Details</ContainerTransform.Trigger>
          <ContainerTransform.Viewport
            summary={
              <Card.Body fill={false} padding="tight">
                <Title>{experience.organization}</Title>
                <Meta>{experience.role}</Meta>
              </Card.Body>
            }
          >
            <Card.Body fill={false} padding="tight">
              <Title>{experience.organization}</Title>
              <Meta>{experience.role}</Meta>
              <Prose>{experience.summary}</Prose>
              <For each={details$}>{(detail$) => <Prose>{detail$.get()}</Prose>}</For>
            </Card.Body>
          </ContainerTransform.Viewport>
        </Card.Content>
        <Card.Footer rule="above" ruleLook="engraved">
          <Tags items={experience.tags} />
        </Card.Footer>
      </Card.Body>
    </ContainerTransform.Root>
  );
}

function ExpertiseCard({
  expertise,
  expanded,
  onExpandedChange,
  onContentHeightChange,
}: Readonly<{ expertise: Expertise }> & ContentMotionProps) {
  const groups$ = useComputed(() => expertise.groups, [expertise.groups]);
  return (
    <NestedUnfold.Root open={expanded} onOpenChange={onExpandedChange}>
      <Card.Body onContentHeightChange={onContentHeightChange}>
        <Card.Header>
          <Kind>Expertise</Kind>
        </Card.Header>
        <Card.Content>
          <Title>{expertise.title}</Title>
          <NestedUnfold.Trigger>Expertise areas</NestedUnfold.Trigger>
          <NestedUnfold.Viewport>
            <For each={groups$}>
              {(group$) => (
                <NestedUnfold.Item
                  index={expertise.groups.indexOf(group$.peek())}
                  count={expertise.groups.length}
                >
                  <Surface padding="none" interactive={false} tone="card">
                    <Card.Body fill={false} padding="tight">
                      <Kind>{group$.title.get()}</Kind>
                      <Tags items={group$.items.get()} />
                    </Card.Body>
                  </Surface>
                </NestedUnfold.Item>
              )}
            </For>
          </NestedUnfold.Viewport>
        </Card.Content>
      </Card.Body>
    </NestedUnfold.Root>
  );
}

function EducationCard({
  education,
  onContentHeightChange,
}: Readonly<{ education: Education; onContentHeightChange?: (height: number) => void }>) {
  return (
    <Card.Body onContentHeightChange={onContentHeightChange}>
      <Card.Header>
        <Kind>Education</Kind>
        <Meta>{education.period}</Meta>
      </Card.Header>
      <Card.Content>
        <Title>{education.degree}</Title>
        <Prose>{education.institution}</Prose>
      </Card.Content>
    </Card.Body>
  );
}

const topicColors: Readonly<Record<string, string>> = {
  mcp: "bg-violet-400",
  webmcp: "bg-violet-400",
  "code-intelligence": "bg-sky-400",
  "developer-tools": "bg-emerald-400",
  webgpu: "bg-sky-400",
  animation: "bg-rose-400",
  react: "bg-sky-400",
  "user-experience": "bg-rose-400",
  automation: "bg-violet-400",
  cli: "bg-amber-400",
  npm: "bg-amber-400",
  "open-source": "bg-emerald-400",
  community: "bg-rose-400",
};

function RepositoryCard({
  repository,
  onContentHeightChange,
}: Readonly<{ repository: Repository; onContentHeightChange?: (height: number) => void }>) {
  return (
    <Card.Body onContentHeightChange={onContentHeightChange}>
      <Card.Header>
        <Meta>{repository.owner.login}/</Meta>
        <Meta>{repository.isPrivate ? "Private" : "Public"}</Meta>
      </Card.Header>
      <Card.Content>
        <Title>{repository.name}</Title>
        {repository.description === null ? null : <Prose>{repository.description}</Prose>}
      </Card.Content>
      <Card.Footer align="center" rule="above" ruleLook="engraved" className="flex-nowrap">
        <Row justify="start" gap="xs" className="flex-1">
          {repository.topics.map((topic) => (
            <Badge key={topic} tone="outline" className="rounded-pk-chip">
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${topicColors[topic] ?? "bg-pk-ink-dim"}`}
              />
              {topic}
            </Badge>
          ))}
        </Row>
        <Row gap="none" className="flex-nowrap">
          {[
            ...(repository.npmUrl === undefined ? [] : [{ url: repository.npmUrl, icon: siNpm }]),
            { url: repository.url, icon: siGithub },
          ].map(({ url, icon }) => (
            <Link
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${repository.name} on ${icon.title}`}
              title={`Open on ${icon.title}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-pk-control-inner text-pk-ink-faint hover:text-pk-ink"
            >
              {icon === siNpm ? (
                <img src={npm} alt="" className="size-4" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
                  <path d={icon.path} />
                </svg>
              )}
            </Link>
          ))}
        </Row>
      </Card.Footer>
    </Card.Body>
  );
}

function ContactCard({
  contact,
  onContentHeightChange,
}: Readonly<{ contact: Contact; onContentHeightChange?: (height: number) => void }>) {
  return (
    <Card.Body onContentHeightChange={onContentHeightChange}>
      <Card.Header>
        <Kind>Contact</Kind>
      </Card.Header>
      <Card.Content>
        <Title>{contact.title}</Title>
        <Link href={`mailto:${contact.email}`}>
          <Prose>{contact.email}</Prose>
        </Link>
      </Card.Content>
      <Card.Footer rule="above" ruleLook="engraved">
        <Links links={contact.links} />
      </Card.Footer>
    </Card.Body>
  );
}

export const components = defineComponents({
  components: {
    "flow-study": {
      aspectRatio: 1,
      section: false,
      size: { width: 320, height: 320 },
      schema: type({ paused: "boolean = false" }),
      render: (props) => (
        <ShaderSurface
          shader={flowShader.source}
          geometry={flowShader.geometry}
          renderScale={flowShader.renderScale}
          paused={props.paused}
          className="flow-study block aspect-square h-auto w-full"
        />
      ),
    },
    career: {
      schema: careerEntry,
      render: (props, context) => (
        <CareerCard entry={props} onContentHeightChange={context.onContentHeightChange} />
      ),
    },
    "career-detail": {
      schema: careerEntry.merge({ source: "string > 0" }),
      section: false,
      size: { width: 360, height: 480 },
      render: (props, context) => (
        <CareerCard
          entry={props}
          source={props.source}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    "icon-square": {
      aspectRatio: 1,
      section: false,
      size: { width: 80, height: 80 },
      maxSize: { width: 96, height: 96 },
      actions: {
        brand: {
          label: "Use brand colors",
          multiple: true,
          set: { color: "brand" },
          enabled: (props) => props.color !== "brand",
        },
        monochrome: {
          label: "Use monochrome",
          multiple: true,
          set: { color: "monochrome" },
          enabled: (props) => props.color !== "monochrome",
        },
      },
      schema: type({
        icon: type
          .enumerated(...(Object.keys(icons) as (keyof typeof icons)[]))
          .default("typescript"),
        color: "'monochrome' | 'brand' = 'brand'",
      }),
      render: (props) => {
        const icon = icons[props.icon];
        return (
          <Tooltip>
            <Tooltip.Trigger
              render={<div />}
              delay={0}
              role="img"
              aria-label={icon.title}
              tabIndex={0}
              className={styles().tile({
                className:
                  "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pk-accent",
              })}
              style={{ color: props.color === "brand" ? `#${icon.hex}` : undefined }}
            >
              <svg
                className={styles().icon()}
                viewBox={"image" in icon ? "0 0 192 208" : "0 0 24 24"}
                aria-hidden="true"
                fill="currentColor"
              >
                {"image" in icon ? (
                  <image
                    href={icon.image}
                    width="1536"
                    height="1872"
                    className={props.color === "monochrome" ? "grayscale" : undefined}
                  />
                ) : (
                  <path d={icon.path} />
                )}
              </svg>
            </Tooltip.Trigger>
            <Tooltip.Content>{icon.title}</Tooltip.Content>
          </Tooltip>
        );
      },
    },
    resume: {
      actions: {
        print: {
          label: "Show receipt",
          set: { printed: true },
          enabled: (props) => !props.printed,
        },
        retract: {
          label: "Retract receipt",
          set: { printed: false },
          enabled: (props) => props.printed,
        },
      },
      schema: type({
        fileName: "string > 0 = 'resume.pdf'",
        href: type(/^(?:https:\/\/|\/(?!\/))/).default("/resume.pdf"),
        description: "string = 'PDF'",
        printed: "boolean = false",
        feedDuration: "number > 0 = 1.75",
        retractDuration: "number > 0 = 0.6",
      }),
      render: (props, context) => (
        <Card.Body fill={false}>
          <Printer
            printed={props.printed}
            feedDuration={props.feedDuration}
            retractDuration={props.retractDuration}
            onPrintedChange={(printed) => context.onPropsChange({ printed })}
          >
            <Printer.Machine>
              <Card.Body fill={false} padding="tight">
                <Card.Header>
                  <Title>{props.fileName}</Title>
                  <Printer.Trigger />
                </Card.Header>
                <Label>{props.description}</Label>
                <Printer.Status />
              </Card.Body>
              <Printer.Mouth />
            </Printer.Machine>
            <Printer.Feed>
              <Receipt>
                <Receipt.Head mark="↓" wordmark="Résumé" />
                <Receipt.Rule />
                <Receipt.Line name={props.fileName} amount="PDF" />
                <Receipt.Note>{props.description}</Receipt.Note>
                <Receipt.Rule />
                <Receipt.Action
                  nativeButton={false}
                  render={<Link href={props.href} download={props.fileName} />}
                >
                  Download PDF
                </Receipt.Action>
              </Receipt>
            </Printer.Feed>
          </Printer>
        </Card.Body>
      ),
    },
    sparkline: {
      schema: type({
        label: "string > 0 = 'Activity'",
        values: type("number[]").default(() => []),
        animation: "'none' | 'reveal' | 'sweep' = 'reveal'",
        duration: "number > 0 = 1.2",
        repeatDelay: "number >= 0 = 3",
        "caption?": "string",
      }),
      actions: {
        stop: {
          label: "Stop animation",
          multiple: true,
          set: { animation: "none" },
          enabled: (props) => props.animation !== "none",
        },
        reveal: {
          label: "Reveal animation",
          multiple: true,
          set: { animation: "reveal" },
          enabled: (props) => props.animation !== "reveal",
        },
        sweep: {
          label: "Sweep animation",
          multiple: true,
          set: { animation: "sweep" },
          enabled: (props) => props.animation !== "sweep",
        },
      },
      render: (props) => (
        <Card.Body fill={false}>
          <Label>{props.label}</Label>
          <Sparkline {...props} size="lg" />
        </Card.Body>
      ),
    },
    contributions: {
      schema: contributionCalendar,
      render: (props, context) => (
        <ContributionsCard calendar={props} onContentHeightChange={context.onContentHeightChange} />
      ),
    },
    repository: {
      schema: repository,
      render: (props, context) => (
        <RepositoryCard repository={props} onContentHeightChange={context.onContentHeightChange} />
      ),
    },
    note: {
      schema: type({
        title: "string > 0 = 'Note'",
        text: "string = ''",
        accent: "string = '#00e6a8'",
      }),
      render: (props, context) => (
        <EditableNote text={props.text} onTextChange={(text) => context.onPropsChange({ text })}>
          <Card.Body
            fill={false}
            className={styles().note()}
            style={{ borderInlineStartColor: props.accent }}
          >
            <Card.Header>
              <Title>{props.title}</Title>
              <EditableNote.Trigger />
            </Card.Header>
            <EditableNote.Preview />
            <EditableNote.Editor aria-label="Note text" />
          </Card.Body>
        </EditableNote>
      ),
    },
    progress: {
      schema: type({ label: "string > 0 = 'Progress'", value: "0 <= number <= 100 = 0" }),
      render: (props) => (
        <Card.Body fill={false}>
          <Label>{props.label}</Label>
          <Display render={<span />}>{props.value}%</Display>
        </Card.Body>
      ),
    },
    checklist: {
      section: false,
      schema: type({
        title: "string > 0 = 'Checklist'",
        items: type({ id: "string > 0", label: "string > 0", done: "boolean" })
          .array()
          .default(() => []),
      }),
      actions: {
        complete: {
          label: "Complete all items",
          update: (props) => ({ items: props.items.map((item) => ({ ...item, done: true })) }),
          enabled: (props) => props.items.some((item) => !item.done),
        },
        reopen: {
          label: "Reopen all items",
          update: (props) => ({ items: props.items.map((item) => ({ ...item, done: false })) }),
          enabled: (props) => props.items.some((item) => item.done),
        },
      },
      render: (props, context) => (
        <Card.Body fill={false}>
          <Title>{props.title}</Title>
          {props.items.map((item) => (
            <Row key={item.id} justify="start">
              <Checkbox
                aria-label={item.label}
                checked={item.done}
                onCheckedChange={(done) =>
                  context.onPropsChange({
                    items: props.items.map((current) =>
                      current.id === item.id ? { ...current, done } : current,
                    ),
                  })
                }
              />
              <Label>{item.label}</Label>
            </Row>
          ))}
        </Card.Body>
      ),
    },
    profile: {
      schema: type({
        content: user,
        about: "string = ''",
      }),
      render: (props, context) => (
        <ProfileCard
          user={props.content}
          about={props.about}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    project: {
      schema: type({ content: project, expanded: "boolean = false" }),
      actions: {
        expand: {
          label: "Show details",
          set: { expanded: true },
          enabled: (props) => !props.expanded,
        },
        collapse: {
          label: "Hide details",
          set: { expanded: false },
          enabled: (props) => props.expanded,
        },
      },
      render: (props, context) => (
        <ProjectCard
          project={props.content}
          expanded={props.expanded}
          onExpandedChange={(expanded) => context.onPropsChange({ expanded })}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    experience: {
      schema: type({ content: experience, expanded: "boolean = false" }),
      render: (props, context) => (
        <ExperienceCard
          experience={props.content}
          expanded={props.expanded}
          onExpandedChange={(expanded) => context.onPropsChange({ expanded })}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    expertise: {
      schema: type({ content: expertise, expanded: "boolean = false" }),
      render: (props, context) => (
        <ExpertiseCard
          expertise={props.content}
          expanded={props.expanded}
          onExpandedChange={(expanded) => context.onPropsChange({ expanded })}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    education: {
      schema: type({ content: education }),
      render: (props, context) => (
        <EducationCard
          education={props.content}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
    contact: {
      schema: type({ content: contact }),
      render: (props, context) => (
        <ContactCard
          contact={props.content}
          onContentHeightChange={context.onContentHeightChange}
        />
      ),
    },
  },
});
