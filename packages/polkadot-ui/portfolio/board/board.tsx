import "./board.css";

import {
  InfiniteCanvasProvider,
  DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS,
  InfiniteCanvasViewport,
  createInfiniteCanvasHandle,
  createInfiniteCanvasStore,
  defineInfiniteCanvasWindowRegistry,
  editComponentProps,
  insertComponent,
  resolveComponentProps,
  useInfiniteCanvasStore,
  type InfiniteCanvasWindowRenderContext,
} from "@hyphened/infinite-canvas";
import { For, Show, useComputed, useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Debouncer } from "@tanstack/pacer";
import { useModelContextTools } from "model-context/react";
import { type } from "arktype";
import { Button, Card, CanvasCommand, Label, Menu, Prose, Row, Surface, tv } from "polkadot-ui";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Portfolio } from "../data/portfolio.ts";
import { portfolioQuery } from "../data/queries.ts";
import { saveBoard } from "../data/portfolio.ts";
import { queryClient } from "../data/query-client.ts";
import { contentTools } from "../data/tools.ts";
import { components } from "../widgets/content.tsx";
import { loadBoardState, reconcileBoard } from "./document.ts";
import { componentInstance } from "../content/model.ts";
import { ROW_HEIGHT } from "./layout.ts";
import { boardTools } from "./tools.ts";
import { ProfileEditor } from "./profile-editor.tsx";
const boardStyles = tv({
  slots: {
    page: "bg-pk-ground bg-[radial-gradient(72%_52%_at_50%_-8%,rgba(255,255,255,0.05),transparent_68%)]",
    body: "overflow-auto",
    content: "flex w-full",
    commands: "absolute bottom-4 left-4 z-10",
  },
  variants: { fill: { true: { content: "min-h-full" } } },
});

function MeasuredWidget({
  context,
}: Readonly<{ context: InfiniteCanvasWindowRenderContext<"widget"> }>) {
  const store = useInfiniteCanvasStore<"widget">();
  const { data } = useQuery(portfolioQuery);
  const parsed = componentInstance(context.window.data);
  const instance = parsed instanceof type.errors ? null : parsed;
  const definition = Object.values(components).find((item) => item.id === instance?.component.id);
  const resolved =
    instance &&
    resolveComponentProps({
      node: instance,
      resolveRecord: (reference) =>
        data?.content.widgets.find(
          (item) =>
            reference.model.contractVersion === 1 &&
            item.id === reference.recordId &&
            item.kind === reference.model.id,
        ),
    });
  const widget =
    resolved !== null && !(resolved instanceof Error) && !(resolved instanceof type.errors)
      ? resolved.props.content
      : undefined;
  const [targetSize, setTargetSize] = useState<Readonly<{
    widget: typeof widget;
    height: number;
  }> | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  // Legend's declaration predates nullable React refs.
  const size$ = useMeasure(ref as Parameters<typeof useMeasure>[0]);
  const measuredHeight = useValue(() =>
    context.window.heightMode === "manual" ? undefined : size$.height.get(),
  );

  useLayoutEffect(() => {
    const body = ref.current?.parentElement;
    const frame = body?.closest<HTMLElement>("[data-infinite-canvas-window-id]");
    if (measuredHeight === undefined || measuredHeight <= 0 || body == null || frame == null)
      return;
    const frameHeight = frame.offsetHeight - body.clientHeight;
    const height =
      (targetSize !== null && targetSize.widget === widget ? targetSize.height : measuredHeight) +
      frameHeight;
    context.actions.setWindowContentHeight({ windowId: context.window.id, height });
  }, [context, measuredHeight, targetSize, widget]);

  if (
    instance === null ||
    resolved === null ||
    resolved instanceof Error ||
    resolved instanceof type.errors ||
    definition === undefined
  ) {
    return (
      <Card.Body fill={false}>
        <Prose role="alert">This component’s content reference is invalid.</Prose>
      </Card.Body>
    );
  }
  const rendered = definition.render(resolved.props, {
    onPropsChange: (props) => {
      if (data === undefined) return;
      const result = editComponentProps({
        handle: createInfiniteCanvasHandle(store),
        components,
        input: { windowId: context.window.id, expectedRevision: instance.revision, props },
        resolveRecord: (reference) =>
          data.content.widgets.find(
            (item) =>
              reference.model.contractVersion === 1 &&
              item.id === reference.recordId &&
              item.kind === reference.model.id,
          ),
      });
      if (result instanceof Error || result instanceof type.errors)
        console.warn("The component configuration was refused.", result);
    },
    onTargetSizeChange: ({ height, element }) => {
      if (context.window.heightMode === "manual" || ref.current === null) return;
      const targetHeight = Math.ceil(ref.current.offsetHeight - element.offsetHeight + height);
      setTargetSize((current) => {
        if (current !== null && current.widget === widget && current.height === targetHeight)
          return current;
        return { widget, height: targetHeight };
      });
    },
  });
  return (
    <div
      className={boardStyles({ fill: context.window.heightMode === "manual" }).content()}
      ref={ref}
    >
      {rendered instanceof type.errors ? <Prose role="alert">{rendered.summary}</Prose> : rendered}
    </div>
  );
}

const registry = defineInfiniteCanvasWindowRegistry<"widget">({
  widget: {
    kind: "widget",
    bodyPointerBehavior: "move",
    textSelection: "native",
    renderFrame: ({ frame, window }) => {
      const node = componentInstance(window.data);
      const rim =
        !(node instanceof type.errors) &&
        node.props.rim?.kind === "literal" &&
        node.props.rim.value === true;
      return (
        <frame.Surface
          render={(props, { children }) => (
            <Surface
              {...props}
              container
              padding="none"
              interactive={rim}
              tone={rim ? "rim" : "card"}
            >
              {children}
            </Surface>
          )}
        >
          <frame.Body className={boardStyles().body()} />
        </frame.Surface>
      );
    },
    renderBody: (context) => <MeasuredWidget context={context} />,
  },
});

function Board({
  portfolio,
  initialRowHeight,
}: Readonly<{ portfolio: Portfolio; initialRowHeight: number }>) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const commands$ = useComputed(() => DEFAULT_INFINITE_CANVAS_COMMAND_DESCRIPTORS);
  const insertable$ = useComputed(() =>
    Object.values(components).filter(({ schema }) => schema.allows({})),
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const editProfileRef = useRef<HTMLButtonElement | null>(null);
  const profile = portfolio.content.widgets.find((widget) => widget.kind === "profile");
  const [runtime] = useState(() => {
    const store = createInfiniteCanvasStore<"widget">(
      loadBoardState(portfolio.board, portfolio.content, initialRowHeight),
    );
    return { store, handle: createInfiniteCanvasHandle(store) };
  });

  useEffect(() => {
    reconcileBoard({
      commands: runtime.handle.commands,
      state: runtime.handle.getState(),
      content: portfolio.content,
    });
  }, [portfolio.content, runtime]);

  useEffect(() => {
    const writes = { pending: Promise.resolve() };
    const save = new Debouncer(
      () => {
        const board = JSON.stringify(runtime.handle.snapshot());
        writes.pending = writes.pending
          .then(async () => {
            await saveBoard(board);
            setSaveError(null);
          })
          .catch((error: unknown) => {
            console.warn("The board layout could not be saved. Later edits can retry.", error);
            setSaveError("Layout save failed. Changes remain in this session.");
          });
      },
      { wait: 500 },
    );
    const unsubscribe = runtime.handle.subscribeDocument(save.maybeExecute);
    return () => {
      unsubscribe();
      save.flush();
    };
  }, [runtime]);

  const tools = useMemo(() => [...contentTools, ...boardTools(runtime.handle)], [runtime]);
  useModelContextTools(tools);

  return (
    <div className={boardStyles().page({ className: "board-page" })} data-board="">
      {profile !== undefined && (
        <aside className="board-authoring" aria-label="Portfolio editing">
          <Button
            ref={editProfileRef}
            aria-expanded={editingProfile}
            onClick={() => setEditingProfile(true)}
          >
            Edit profile
          </Button>
          {editingProfile && (
            <ProfileEditor
              profile={profile}
              onClose={() => {
                setEditingProfile(false);
                editProfileRef.current?.focus();
              }}
            />
          )}
        </aside>
      )}
      <InfiniteCanvasProvider store={runtime.store}>
        <Row className={boardStyles().commands()} role="group" aria-label="Canvas commands">
          <Show if={saveError}>
            <Prose role="alert">{saveError}</Prose>
          </Show>
          <Show if={creationError}>
            <Prose role="alert">{creationError}</Prose>
          </Show>
          <Menu>
            <Menu.Trigger>Add component</Menu.Trigger>
            <Menu.Content side="top">
              <For each={insertable$}>
                {(component$) => (
                  <Menu.Item
                    onClick={() => {
                      const { center } = runtime.handle.getState().camera;
                      const result = insertComponent({
                        handle: runtime.handle,
                        components,
                        kind: "widget",
                        input: {
                          windowId: crypto.randomUUID(),
                          componentId: component$.id.get(),
                          props: {},
                          rect: { x: center.x - 160, y: center.y - 120, width: 320, height: 240 },
                        },
                      });
                      if (result instanceof type.errors) setCreationError(result.summary);
                      else setCreationError(result instanceof Error ? result.message : null);
                    }}
                  >
                    {component$.id.get()}
                  </Menu.Item>
                )}
              </For>
            </Menu.Content>
          </Menu>
          <CanvasCommand commandId="history.undo" />
          <CanvasCommand commandId="history.redo" />
          <CanvasCommand commandId="view.fitAll" />
          <Menu>
            <Menu.Trigger>Commands</Menu.Trigger>
            <Menu.Content side="top">
              <For each={commands$}>
                {(command$) => <CanvasCommand.Item commandId={command$.id.get()} />}
              </For>
            </Menu.Content>
          </Menu>
        </Row>
        <InfiniteCanvasViewport<"widget">
          chrome={{ headerHeight: 0 }}
          hud={false}
          renderBackdrop={() => null}
          windowDefinitions={registry}
        />
      </InfiniteCanvasProvider>
    </div>
  );
}

function PortfolioLoader({ initialRowHeight }: Readonly<{ initialRowHeight: number }>) {
  const query = useQuery(portfolioQuery);
  if (query.data !== undefined)
    return <Board portfolio={query.data} initialRowHeight={initialRowHeight} />;
  if (query.error !== null) {
    return (
      <Surface role="alert" interactive={false}>
        <Label>The portfolio could not load</Label>
        <Prose>Your saved content is retained. Retry to reconnect.</Prose>
        <Button
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          Retry
        </Button>
      </Surface>
    );
  }
  return (
    <Card.Body fill={false} role="status">
      <Label>Loading portfolio…</Label>
    </Card.Body>
  );
}

export function PortfolioBoard({
  initialRowHeight = ROW_HEIGHT,
}: Readonly<{ initialRowHeight?: number }> = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <PortfolioLoader initialRowHeight={initialRowHeight} />
    </QueryClientProvider>
  );
}
