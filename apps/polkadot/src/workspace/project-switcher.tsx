import { useObservable, useValue } from "@legendapp/state/react";
import { getHotkeyManager } from "@tanstack/hotkeys";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { FolderPlus, PencilLine } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import { initialLayout } from "../canvas/canvas-document";
import type { ProjectSummary } from "../database/database.client";

/**
 * The project, wearing the brand mark.
 *
 * Project and canvas are the two levels of "where am I", and they read that way in the rail: the
 * mark carries the project, the name beside it carries the canvas. Nesting them spatially is why
 * this needs no chrome of its own — a second labelled dropdown next to the first would say the
 * app has two equal selectors, which is not what the hierarchy is.
 *
 * Switching projects is not a filter, it is a different workbench: the target project's most
 * recent canvas is a different route, so the canvas store, note stores, and persistence loop are
 * all torn down and rebuilt by the route key rather than by anything here.
 */

const projectSwitcher = tv({
  slots: {
    input:
      "w-36 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    mark: "grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] font-mono text-[11px] font-semibold text-[var(--primary-foreground)] transition-[filter,transform] duration-150 ease-[var(--ease-swift)] outline-none hover:brightness-110 focus-visible:brightness-110 data-popup-open:brightness-110",
  },
});

const projectGateway = {
  create: async (title: string) =>
    (await import("../database/database.client")).createProject({ layout: initialLayout, title }),
  firstCanvasOf: async (projectId: string) =>
    (await import("../database/database.client")).listCanvases(projectId),
  list: async () => (await import("../database/database.client")).listProjects(),
  rename: async (projectId: string, title: string) =>
    (await import("../database/database.client")).renameProject({ projectId, title }),
};

export function ProjectSwitcher({
  projectId,
  projectTitle,
}: Readonly<{ projectId: string; projectTitle: string }>) {
  const navigate = useNavigate();
  const router = useRouter();
  const projects$ = useObservable<readonly ProjectSummary[]>([]);
  const draftTitle$ = useObservable<string | null>(null);
  const projects = useValue(projects$);
  const draftTitle = useValue(draftTitle$);
  const inputRef = useRef<HTMLInputElement>(null);
  const styles = projectSwitcher();

  const openProject = (nextProjectId: string) => {
    if (nextProjectId === projectId) {
      return;
    }

    // A project is entered through one of its canvases, most recent first — the same rule `/`
    // uses, so entering a project and entering the app land in the same place.
    void projectGateway.firstCanvasOf(nextProjectId).then((canvases) => {
      const [first] = canvases;

      if (first !== undefined) {
        void navigate({ params: { canvasId: first.id }, to: "/canvas/$canvasId" });
      }
    });
  };

  const commitRename = () => {
    const nextTitle = (draftTitle$.peek() ?? "").trim();

    draftTitle$.set(null);

    if (nextTitle.length > 0 && nextTitle !== projectTitle) {
      void projectGateway.rename(projectId, nextTitle).then(() => router.invalidate());
    }
  };

  useEffect(() => {
    const node = inputRef.current;

    if (node === null) {
      return;
    }

    const manager = getHotkeyManager();
    const handles = [
      manager.register("Enter", commitRename, { ignoreInputs: false, target: node }),
      manager.register(
        "Escape",
        () => {
          draftTitle$.set(null);
        },
        { ignoreInputs: false, target: node },
      ),
    ];

    return () => {
      for (const handle of handles) {
        if (handle.isActive) {
          handle.unregister();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTitle !== null, draftTitle$, projectId, projectTitle, router]);

  if (draftTitle !== null) {
    return (
      <input
        aria-label="Project name"
        autoFocus
        className={styles.input()}
        onBlur={commitRename}
        onChange={(event) => {
          draftTitle$.set(event.target.value);
        }}
        ref={inputRef}
        value={draftTitle}
      />
    );
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          void projectGateway.list().then((records) => {
            projects$.set(records);
          });
        }
      }}
    >
      <DropdownMenuTrigger
        aria-label={`Project: ${projectTitle}`}
        className={styles.mark()}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        title={projectTitle}
      >
        {projectTitle.trim().slice(0, 1).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup onValueChange={openProject} value={projectId}>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuRadioItem key={project.id} value={project.id}>
              <span className={styles.itemTitle()}>{project.title}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            draftTitle$.set(projectTitle);
          }}
        >
          <PencilLine />
          Rename project
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void projectGateway.create(`Project ${projects.length + 1}`).then((created) => {
              void navigate({ params: { canvasId: created.id }, to: "/canvas/$canvasId" });
            });
          }}
        >
          <FolderPlus />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
