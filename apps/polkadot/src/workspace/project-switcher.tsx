import { useObservable, useValue } from "@legendapp/state/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Archive, ArchiveRestore, FolderPlus, PencilLine, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";
import { tv } from "ui/tv";

import { initialLayout } from "../canvas/canvas-document";
import { useInlineRename } from "./use-inline-rename";
import type { ProjectSummary } from "../database/database.client";
import * as database from "../database/operations";
import { ProjectRemovalDialog } from "./project-removal-dialog";

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

export function ProjectSwitcher({
  projectId,
  projectTitle,
}: Readonly<{ projectId: string; projectTitle: string }>) {
  const navigate = useNavigate();
  const router = useRouter();
  const projects$ = useObservable<readonly ProjectSummary[]>([]);
  const archived$ = useObservable<readonly ProjectSummary[]>([]);
  const isRemoving$ = useObservable(false);
  const projects = useValue(projects$);
  const archived = useValue(archived$);
  const isRemoving = useValue(isRemoving$);
  const styles = projectSwitcher();

  // `/` re-resolves the most recent canvas across whatever projects remain, and bootstraps a
  // fresh one when the last is gone — so leaving a destroyed project needs no destination logic.
  const leaveRemovedProject = () => {
    void navigate({ to: "/" });
  };

  const openProject = (nextProjectId: string) => {
    if (nextProjectId === projectId) {
      return;
    }

    // A project is entered through one of its canvases, most recent first — the same rule `/`
    // uses, so entering a project and entering the app land in the same place.
    void database.canvases.list(nextProjectId).then((canvases) => {
      const [first] = canvases;

      if (first !== undefined) {
        void navigate({ params: { canvasId: first.id }, to: "/canvas/$canvasId" });
      }
    });
  };

  const rename = useInlineRename({
    current: projectTitle,
    onRename: (nextTitle) => {
      void database.projects
        .rename({ projectId, title: nextTitle })
        .then(() => router.invalidate());
    },
  });

  if (rename.draft !== null) {
    return <input aria-label="Project name" className={styles.input()} {...rename.inputProps} />;
  }

  return (
    <>
      <ProjectRemovalDialog
        onOpenChange={(open) => {
          isRemoving$.set(open);
        }}
        onRemoved={leaveRemovedProject}
        open={isRemoving}
        projectId={projectId}
      />
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            void database.projects.list().then((records) => {
              projects$.set(records);
            });
            void database.projects.listArchived().then((records) => {
              archived$.set(records);
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
          {archived.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Archived</DropdownMenuLabel>
              {archived.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => {
                    void database.projects.restore(project.id).then(() => {
                      openProject(project.id);
                    });
                  }}
                >
                  <ArchiveRestore />
                  <span className={styles.itemTitle()}>{project.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={rename.start}>
            <PencilLine />
            Rename project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void database.projects
                .create({ layout: initialLayout, title: `Project ${projects.length + 1}` })
                .then((created) => {
                  void navigate({ params: { canvasId: created.id }, to: "/canvas/$canvasId" });
                });
            }}
          >
            <FolderPlus />
            New project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void database.projects.archive(projectId).then(leaveRemovedProject);
            }}
          >
            <Archive />
            Archive project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              isRemoving$.set(true);
            }}
            variant="destructive"
          >
            <Trash2 />
            Delete project…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
