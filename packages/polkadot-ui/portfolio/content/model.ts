import { type } from "arktype";
import { canvasModel } from "@hyphened/infinite-canvas";

const link = type({ label: "string > 0", href: type("string.url").and(/^https:\/\//) });
const section = type({ title: "string > 0", body: "string > 0" });
const placement = {
  id: /^[a-z][a-z0-9-]*$/,
  span: "1 <= number.integer <= 12",
} as const;

export const profile = type({
  ...placement,
  kind: "'profile'",
  name: "string > 0",
  role: "string > 0",
  summary: "string > 0",
  location: "string > 0",
  availability: "string > 0",
});

export const project = type({
  ...placement,
  kind: "'project'",
  title: "string > 0",
  period: "string > 0",
  visibility: "'Open source' | 'Private'",
  summary: "string > 0",
  sections: section.array(),
  tags: "string[]",
  links: link.array(),
});

export const experience = type({
  ...placement,
  kind: "'experience'",
  organization: "string > 0",
  role: "string > 0",
  period: "string > 0",
  summary: "string > 0",
  details: "string[]",
  tags: "string[]",
});

export const expertise = type({
  ...placement,
  kind: "'expertise'",
  title: "string > 0",
  groups: type({ title: "string > 0", items: "string[]" }).array(),
});

export const education = type({
  ...placement,
  kind: "'education'",
  degree: "string > 0",
  institution: "string > 0",
  period: "string > 0",
});

export const contact = type({
  ...placement,
  kind: "'contact'",
  title: "string > 0",
  email: "string.email",
  links: link.array(),
});

export const widget = profile.or(project).or(experience).or(expertise).or(education).or(contact);
export const document = type({ widgets: widget.array() });
export const widgetKinds = { profile, project, experience, expertise, education, contact };
export const componentInstance = canvasModel.ComponentNode;
export const componentConfiguration = canvasModel.ComponentPropsEdit;
export type ComponentInstance = typeof componentInstance.infer;

export type Widget = typeof widget.infer;
export type PortfolioDocument = typeof document.infer;
export type Project = typeof project.infer;
export type Experience = typeof experience.infer;
export type Expertise = typeof expertise.infer;
export type Profile = typeof profile.infer;
export type Education = typeof education.infer;
export type Contact = typeof contact.infer;

/** Each widget needs a unique identity for storage and rendering. */
export function parseDocument(value: unknown): PortfolioDocument {
  const parsed = document.assert(value);
  const ids = new Set(parsed.widgets.map((item) => item.id));

  if (ids.size !== parsed.widgets.length) {
    throw new Error("Each widget must have a unique id.");
  }

  return parsed;
}
