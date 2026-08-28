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

import { createProject } from "./create-project";
import { useGoToCanvas } from "./use-go-to-canvas";
import { getProjectEntryCanvas } from "../projects/enter-project";
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
    /** Says the list has not answered yet. An empty label with nothing under it says the wrong thing. */
    empty: "px-1.5 py-1 text-[12px] text-[var(--ink-faint)]",
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

  const goToCanvas = useGoToCanvas();

  // `/` re-resolves the most recent canvas across whatever projects remain, and bootstraps a
  // fresh one when the last is gone — so leaving a destroyed project needs no destination logic.
  const leaveRemovedProject = () => {
    void navigate({ to: "/" });
  };

  // Where a project opens is the verb's decision, including whether it is a move at all. This is
  // the control that calls it.
  const openProject = (nextProjectId: string) => {
    void getProjectEntryCanvas({ openProjectId: projectId, projectId: nextProjectId }).then(
      (canvasId) => {
        if (canvasId !== null) {
          void goToCanvas(canvasId);
        }
      },
    );
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
            {/*
              "Loading…" rather than nothing, the same as the canvas switcher beside it.

              The list is fetched when the menu opens, so `[]` on the first open means "nobody has
              asked yet" — and rendering a "Projects" heading with nothing under it answers a
              question that has not been asked, saying you have no projects while you are standing
              in one. `library-rail` states the rule it comes from: an empty state is a claim about
              the world and needs an answer behind it. The canvas switcher had this; this did not.
            */}
            {projects.length === 0 ? (
              <div className={styles.empty()}>Loading…</div>
            ) : (
              projects.map((project) => (
                <DropdownMenuRadioItem key={project.id} value={project.id}>
                  <span className={styles.itemTitle()}>{project.title}</span>
                </DropdownMenuRadioItem>
              ))
            )}
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
              /*
               * The verb owns the naming. This is the control that calls it.
               *
               * `Project ${projects.length + 1}` stood here, and `projects` is the *offered* list
               * — so the count could not see the archived ones listed a few rows above, and a new
               * project took a name an archived one still held. Restoring it from this same menu
               * then put two of one name in the switcher that exists to tell them apart.
               */
              void createProject().then((created) => {
                void goToCanvas(created.id);
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
