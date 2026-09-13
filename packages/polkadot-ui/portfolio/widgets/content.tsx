import { For, Show, useComputed } from "@legendapp/state/react";
import { Backdrop, Badge, Card, ContainerTransform, Display, Kind, Link, Meta, NestedUnfold, Prose, Row, Separator, SPARKLE, Stack, StatusDot, Surface, Title, tv, type BackdropProps, type DisclosureTargetSize } from "polkadot-ui";

import type { Contact, Education, Experience, Expertise, Profile, Project } from "../content/model.ts";
import { ExpandInPlace } from "../../src/components/motion/expand-in-place.tsx";
import { defineComponent } from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { widgetKinds } from "../content/model.ts";
import { authoringComponents } from "./authoring.tsx";

const styles = tv({ slots: { backdrop: "static" } });

type ContentMotionProps = Readonly<{
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onTargetSizeChange?: (size: DisclosureTargetSize) => void;
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
      <For each={links$}>{(link$) => <Link href={link$.href.get()}>{link$.label.get()} ↗</Link>}</For>
    </Row>
  );
}

function ProfileCard({ profile, paused, accent }: Readonly<{ profile: Profile }> & Pick<BackdropProps, "paused" | "accent">) {
  return (
    <Backdrop shader={SPARKLE} paused={paused} accent={accent} className={styles().backdrop()}>
    <Card.Body>
      <Row><Kind>{profile.role}</Kind><Meta>{profile.location}</Meta></Row>
      <Display fluid>{profile.name}</Display>
      <Prose>{profile.summary}</Prose>
      <Card.Footer rule="above" ruleLook="engraved"><StatusDot>{profile.availability}</StatusDot></Card.Footer>
    </Card.Body>
    </Backdrop>
  );
}

function ProjectCard({ project, expanded, onExpandedChange, onTargetSizeChange }: Readonly<{ project: Project }> & ContentMotionProps) {
  const sections$ = useComputed(() => project.sections, [project.sections]);
  return (
    <ExpandInPlace.Root open={expanded} onOpenChange={onExpandedChange}>
    <Card.Body>
      <Card.Header><Kind>Project</Kind><Meta>{project.period}</Meta></Card.Header>
      <Title>{project.title}</Title>
      <Prose>{project.summary}</Prose>
      <Tags items={project.tags} />
      <Show if={() => project.sections.length > 0}>
        <ExpandInPlace.Trigger>Details</ExpandInPlace.Trigger>
        <ExpandInPlace.Viewport onTargetSizeChange={onTargetSizeChange}>
        <Separator look="engraved" />
        <Stack gap="lg">
          <For each={sections$}>{(section$) => (
            <Stack gap="sm"><Kind>{section$.title.get()}</Kind><Prose>{section$.body.get()}</Prose></Stack>
          )}</For>
        </Stack>
        </ExpandInPlace.Viewport>
      </Show>
      <Card.Footer rule="above" ruleLook="engraved">
        <Meta>{project.visibility}</Meta><Links links={project.links} />
      </Card.Footer>
    </Card.Body>
    </ExpandInPlace.Root>
  );
}

function ExperienceCard({ experience, expanded, onExpandedChange, onTargetSizeChange }: Readonly<{ experience: Experience }> & ContentMotionProps) {
  const details$ = useComputed(() => experience.details, [experience.details]);
  return (
    <ContainerTransform.Root open={expanded} onOpenChange={onExpandedChange}>
    <Card.Body>
      <Card.Header><Kind>Experience</Kind><Meta>{experience.period}</Meta></Card.Header>
      <ContainerTransform.Trigger>Details</ContainerTransform.Trigger>
      <ContainerTransform.Viewport onTargetSizeChange={onTargetSizeChange} summary={
        <Card.Body fill={false} padding="tight"><Title>{experience.organization}</Title><Meta>{experience.role}</Meta></Card.Body>
      }>
        <Card.Body fill={false} padding="tight">
          <Title>{experience.organization}</Title><Meta>{experience.role}</Meta>
          <Prose>{experience.summary}</Prose>
          <For each={details$}>{(detail$) => <Prose>{detail$.get()}</Prose>}</For>
        </Card.Body>
      </ContainerTransform.Viewport>
      <Card.Footer rule="above" ruleLook="engraved"><Tags items={experience.tags} /></Card.Footer>
    </Card.Body>
    </ContainerTransform.Root>
  );
}

function ExpertiseCard({ expertise, expanded, onExpandedChange, onTargetSizeChange }: Readonly<{ expertise: Expertise }> & ContentMotionProps) {
  const groups$ = useComputed(() => expertise.groups, [expertise.groups]);
  return (
    <NestedUnfold.Root open={expanded} onOpenChange={onExpandedChange}>
    <Card.Body>
      <Kind>Expertise</Kind><Title>{expertise.title}</Title>
      <NestedUnfold.Trigger>Expertise areas</NestedUnfold.Trigger>
      <NestedUnfold.Viewport onTargetSizeChange={onTargetSizeChange}>
      <For each={groups$}>{(group$) => (
        <NestedUnfold.Item index={expertise.groups.indexOf(group$.peek())} count={expertise.groups.length}>
          <Surface padding="none" interactive={false} tone="card">
            <Card.Body fill={false} padding="tight"><Kind>{group$.title.get()}</Kind><Tags items={group$.items.get()} /></Card.Body>
          </Surface>
        </NestedUnfold.Item>
      )}</For>
      </NestedUnfold.Viewport>
    </Card.Body>
    </NestedUnfold.Root>
  );
}

function EducationCard({ education }: Readonly<{ education: Education }>) {
  return (
    <Card.Body>
      <Card.Header><Kind>Education</Kind><Meta>{education.period}</Meta></Card.Header>
      <Title>{education.degree}</Title><Prose>{education.institution}</Prose>
    </Card.Body>
  );
}

function ContactCard({ contact }: Readonly<{ contact: Contact }>) {
  return (
    <Card.Body>
      <Kind>Contact</Kind><Title>{contact.title}</Title>
      <Link href={`mailto:${contact.email}`}><Prose>{contact.email}</Prose></Link>
      <Card.Footer rule="above" ruleLook="engraved"><Links links={contact.links} /></Card.Footer>
    </Card.Body>
  );
}

export const components = {
  ...authoringComponents,
  profile: defineComponent({ id: "profile", schema: type({ content: widgetKinds.profile, rim: "boolean = false", paused: "boolean = false", "accent?": "string" }),
    render: (props) => <ProfileCard profile={props.content} paused={props.paused} accent={props.accent} /> }),
  project: defineComponent({ id: "project", schema: type({ content: widgetKinds.project, expanded: "boolean = false", rim: "boolean = false" }),
    render: (props, context) => <ProjectCard project={props.content} expanded={props.expanded} onExpandedChange={(expanded) => context.onPropsChange({ expanded })} onTargetSizeChange={context.onTargetSizeChange} /> }),
  experience: defineComponent({ id: "experience", schema: type({ content: widgetKinds.experience, expanded: "boolean = false", rim: "boolean = false" }),
    render: (props, context) => <ExperienceCard experience={props.content} expanded={props.expanded} onExpandedChange={(expanded) => context.onPropsChange({ expanded })} onTargetSizeChange={context.onTargetSizeChange} /> }),
  expertise: defineComponent({ id: "expertise", schema: type({ content: widgetKinds.expertise, expanded: "boolean = false", rim: "boolean = false" }),
    render: (props, context) => <ExpertiseCard expertise={props.content} expanded={props.expanded} onExpandedChange={(expanded) => context.onPropsChange({ expanded })} onTargetSizeChange={context.onTargetSizeChange} /> }),
  education: defineComponent({ id: "education", schema: type({ content: widgetKinds.education, rim: "boolean = false" }),
    render: (props) => <EducationCard education={props.content} /> }),
  contact: defineComponent({ id: "contact", schema: type({ content: widgetKinds.contact, rim: "boolean = false" }),
    render: (props) => <ContactCard contact={props.content} /> }),
};
