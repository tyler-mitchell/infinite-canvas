import { defineComponent } from "@hyphened/infinite-canvas";
import { type } from "arktype";
import { Card, Checkbox, Display, EditableNote, Label, Link, Printer, Receipt, Row, Sparkline, Title, tv } from "polkadot-ui";
import { For, useComputed } from "@legendapp/state/react";

const checklistInput = type({ title: "string > 0 = 'Checklist'", items: type({ id: "string > 0", label: "string > 0", done: "boolean" }).array().default(() => []) });
const authoring = tv({ slots: { note: "border-s-2" } });

function Checklist({ title, items, onItemsChange }: typeof checklistInput.infer & { onItemsChange: (items: typeof checklistInput.infer.items) => void }) {
  const items$ = useComputed(() => items, [items]);
  return <Card.Body fill={false}><Title>{title}</Title><For each={items$}>{(item$) => (
    <Row justify="start"><Checkbox aria-label={item$.label.get()} checked={item$.done.get()} onCheckedChange={(done) => {
      onItemsChange(items.map((item) => item.id === item$.id.peek() ? { ...item, done } : item));
    }} /><Label>{item$.label.get()}</Label></Row>
  )}</For></Card.Body>;
}

export const authoringComponents = {
  resume: defineComponent({
    id: "resume",
    schema: type({ fileName: "string > 0 = 'tyler-mitchell-resume.pdf'", href: type(/^(?:https:\/\/|\/(?!\/))/).default("/tyler-mitchell-resume.pdf"), description: "string = 'PDF - 3 pages'", printed: "boolean = false", feedDuration: "number > 0 = 1.75", retractDuration: "number > 0 = 0.6" }),
    render: (props, context) => <Card.Body fill={false}>
      <Printer printed={props.printed} feedDuration={props.feedDuration} retractDuration={props.retractDuration} onPrintedChange={(printed) => context.onPropsChange({ printed })}>
        <Printer.Machine><Card.Body fill={false} padding="tight">
          <Card.Header><Title>{props.fileName}</Title><Printer.Trigger /></Card.Header>
          <Label>{props.description}</Label><Printer.Status />
        </Card.Body><Printer.Mouth /></Printer.Machine>
        <Printer.Feed onTargetSizeChange={context.onTargetSizeChange}>
          <Receipt><Receipt.Head mark="↓" wordmark="Résumé" /><Receipt.Rule />
            <Receipt.Line name={props.fileName} amount="PDF" /><Receipt.Note>{props.description}</Receipt.Note>
            <Receipt.Rule /><Receipt.Action nativeButton={false} render={<Link href={props.href} download={props.fileName} />}>Download PDF</Receipt.Action>
          </Receipt>
        </Printer.Feed>
      </Printer>
    </Card.Body>,
  }),
  sparkline: defineComponent({
    id: "sparkline",
    schema: type({ label: "string > 0 = 'Activity'", values: type("number[]").default(() => []), animation: "'none' | 'reveal' | 'sweep' = 'reveal'", duration: "number > 0 = 1.2", repeatDelay: "number >= 0 = 3", "caption?": "string" }),
    render: (props) => <Card.Body fill={false}><Label>{props.label}</Label><Sparkline {...props} size="lg" /></Card.Body>,
  }),
  note: defineComponent({
    id: "note",
    schema: type({ title: "string > 0 = 'Note'", text: "string = ''", accent: "string = '#00e6a8'" }),
    render: (props, context) => <EditableNote text={props.text} onTextChange={(text) => context.onPropsChange({ text })}>
      <Card.Body fill={false} className={authoring().note()} style={{ borderInlineStartColor: props.accent }}>
        <Card.Header><Title>{props.title}</Title><EditableNote.Trigger /></Card.Header>
        <EditableNote.Preview /><EditableNote.Editor aria-label="Note text" />
      </Card.Body>
    </EditableNote>,
  }),
  progress: defineComponent({
    id: "progress",
    schema: type({ label: "string > 0 = 'Progress'", value: "0 <= number <= 100 = 0" }),
    render: (props) => <Card.Body fill={false}><Label>{props.label}</Label><Display render={<span />}>{props.value}%</Display></Card.Body>,
  }),
  checklist: defineComponent({
    id: "checklist",
    schema: checklistInput,
    render: (props, context) => <Checklist {...props} onItemsChange={(items) => context.onPropsChange({ items })} />,
  }),
};
