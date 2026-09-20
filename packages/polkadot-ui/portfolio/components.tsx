import { For, Show, useComputed } from "@legendapp/state/react";
import {
  Backdrop,
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
  SPARKLE,
  Stack,
  StatusDot,
  Surface,
  Title,
  tv,
  type BackdropProps,
} from "polkadot-ui";

import { ExpandInPlace } from "../src/components/motion/expand-in-place.tsx";
import { defineComponents } from "@hyphened/infinite-canvas/next/react";
import { type } from "arktype";
import { siGithub, siJavascript, siPython, siReact, siRust, siTypescript } from "simple-icons";

const styles = tv({
  slots: {
    backdrop: "static",
    icon: "block aspect-square h-auto w-full",
    note: "border-s-2",
  },
});

const link = type({ label: "string > 0", href: type("string.url").and(/^https:\/\//) });
const section = type({ title: "string > 0", body: "string > 0" });
const profile = type({
  name: "string > 0",
  role: "string > 0",
  summary: "string > 0",
  location: "string > 0",
  availability: "string > 0",
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
type Project = typeof project.infer;
type Experience = typeof experience.infer;
type Expertise = typeof expertise.infer;
type Profile = typeof profile.infer;
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

function ProfileCard({
  profile,
  paused,
  accent,
  onContentHeightChange,
}: Readonly<{ profile: Profile; onContentHeightChange?: (height: number) => void }> &
  Pick<BackdropProps, "paused" | "accent">) {
  return (
    <Backdrop shader={SPARKLE} paused={paused} accent={accent} className={styles().backdrop()}>
      <Card.Body onContentHeightChange={onContentHeightChange}>
        <Card.Header>
          <Kind>{profile.role}</Kind>
          <Meta>{profile.location}</Meta>
        </Card.Header>
        <Card.Content>
          <Display fluid>{profile.name}</Display>
          <Prose>{profile.summary}</Prose>
        </Card.Content>
        <Card.Footer rule="above" ruleLook="engraved">
          <StatusDot>{profile.availability}</StatusDot>
        </Card.Footer>
      </Card.Body>
    </Backdrop>
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
          .enumerated("typescript", "javascript", "react", "github", "python", "rust")
          .default("typescript"),
        color: "'monochrome' | 'brand' = 'brand'",
      }),
      render: (props) => {
        const icons = {
          typescript: siTypescript,
          javascript: siJavascript,
          react: siReact,
          github: siGithub,
          python: siPython,
          rust: siRust,
        };
        const icon = icons[props.icon];
        return (
          <svg
            data-slot="language-icon"
            className={styles().icon()}
            viewBox="0 0 24 24"
            role="img"
            aria-label={icon.title}
            fill={props.color === "brand" ? `#${icon.hex}` : "currentColor"}
          >
            <path d={icon.path} />
          </svg>
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
      schema: type({ content: profile, paused: "boolean = false", "accent?": "string" }),
      actions: {
        pause: {
          label: "Pause background",
          set: { paused: true },
          enabled: (props) => !props.paused,
        },
        resume: {
          label: "Resume background",
          set: { paused: false },
          enabled: (props) => props.paused,
        },
      },
      render: (props, context) => (
        <ProfileCard
          profile={props.content}
          paused={props.paused}
          accent={props.accent}
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
