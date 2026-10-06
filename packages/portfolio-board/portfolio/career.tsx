import { type } from "arktype";
import { ArrowRight, X } from "lucide-react";
import { useCanvasScroll, useCanvasWindow } from "@hyphened/infinite-canvas/next/react";
import { Button, Card, Kind, Meta, Prose, Row, Stack, Title } from "portfolio-board";
import federato from "./federato.png";
import paypal from "./paypal.svg";
import utsa from "./utsa-roadrunner.png";

export const careerEntry = type({
  organization: "string > 0",
  role: "string > 0",
  summary: "string > 0",
  icon: "'paypal' | 'federato' | 'utsa'",
  period: "string > 0",
  sections: type({ title: "string > 0", body: "string > 0" }).array(),
});

function OrganizationIcon({ icon }: { icon: typeof careerEntry.infer.icon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-pk-line bg-pk-surface">
      <img
        src={{ paypal, federato, utsa }[icon]}
        alt=""
        className={
          {
            paypal: "size-5 object-contain",
            federato: "size-full object-cover",
            utsa: "size-6 object-contain",
          }[icon]
        }
      />
    </span>
  );
}

export function CareerCard({
  entry,
  source,
  onContentHeightChange,
}: {
  entry: typeof careerEntry.infer;
  source?: string;
  onContentHeightChange?: (height: number) => void;
}) {
  const { canvas, window } = useCanvasWindow();
  const { attached, scrollTo } = useCanvasScroll();
  const canOpen = source === undefined && entry.sections.length > 0;
  const returnToPortfolio = () => {
    if (source === undefined) return;
    if (attached) scrollTo();
    else
      void canvas.commands.revealWindow.run({
        window: source,
        behavior: { type: "fit", framingMode: "horizontal", maxZoom: 1 },
      });
  };
  const open = async () => {
    const id = `${window.id.peek()}-detail`;
    if (canvas.state.document.content.windows[id].peek() === undefined) {
      const source = canvas.computed.windowRoot[window.id.peek()].peek();
      const result = await canvas.commands.openWindow.run({
        id,
        kind: "career-detail",
        heightMode: "manual",
        title: entry.organization,
        data: { ...entry, source },
        placement: {
          relativeTo: source,
          side: entry.icon === "utsa" ? "right" : "left",
          stack: true,
          gap: 24,
        },
      });
      if (result.error !== null) return;
    }
    await canvas.commands.revealWindow.run({
      window: id,
      behavior: { type: "fit", maxZoom: 1 },
    });
  };
  return (
    <Card.Body
      fill={false}
      onContentHeightChange={onContentHeightChange}
      render={canOpen ? <button type="button" onClick={open} /> : undefined}
      className={canOpen ? "min-h-full w-full cursor-pointer text-left" : "min-h-full"}
    >
      <Card.Header>
        <Row>
          <OrganizationIcon icon={entry.icon} />
          <Title>{entry.organization}</Title>
        </Row>
        {source !== undefined ? (
          <Button
            tone="ghost"
            size="icon"
            onClick={async () => {
              const result = await canvas.commands.closeWindow.run({ window: window.id.peek() });
              if (result.error === null) returnToPortfolio();
            }}
            aria-label={`Close ${entry.organization}`}
          >
            <X />
          </Button>
        ) : null}
      </Card.Header>
      <Card.Content>
        <Title>{entry.role}</Title>
        <Prose>{entry.summary}</Prose>
        {source !== undefined ? (
          <>
            {entry.sections.map((section) => (
              <Stack key={section.title} className="pt-4">
                <Kind>{section.title}</Kind>
                <Prose>{section.body}</Prose>
              </Stack>
            ))}
          </>
        ) : null}
      </Card.Content>
      <Card.Footer rule={source === undefined ? undefined : "above"} ruleLook="engraved">
        <Meta>{entry.period}</Meta>
        {source !== undefined ? (
          <Button tone="ghost" onClick={returnToPortfolio}>
            Back to portfolio <ArrowRight />
          </Button>
        ) : null}
      </Card.Footer>
    </Card.Body>
  );
}
