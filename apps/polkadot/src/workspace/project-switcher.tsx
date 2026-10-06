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

import { formatRelativeTimeNarrow } from "../content/relative-time";
import { createProject } from "./create-project";
import { useGoToCanvas } from "./use-go-to-canvas";
import { getProjectEntryCanvas } from "../projects/enter-project";
import { useInlineRename } from "./use-inline-rename";
import type { ProjectSummary } from "../database/database.client";
import * as database from "../database/operations";
import { ProjectRemovalDialog } from "./project-removal-dialog";

const projectSwitcher = tv({
  slots: {
    empty: "px-1.5 py-1 text-[12px] text-[var(--ink-faint)]",
    input:
      "w-36 rounded-md bg-[var(--ground-sunken)] px-1.5 py-0.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] outline-none inset-ring-1 inset-ring-[var(--accent)]",
    itemTitle: "truncate",
    itemWhen: "ml-auto pl-3 text-[10.5px] text-[var(--ink-faint)] tabular-nums",
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
  // All archive rows use the same time reference.
  const now = Date.now();
  const isRemoving = useValue(isRemoving$);
  const styles = projectSwitcher();

  const goToCanvas = useGoToCanvas();

  // The root route selects the next available project and canvas.
  const leaveRemovedProject = () => {
    void navigate({ to: "/" });
  };

  const openProject = (nextProjectId: string) => {
    void getProjectEntryCanvas({ openProjectId: projectId, projectId: nextProjectId }).then(
      (canvasId) => {
        if (canvasId !== null) {
          void goToCanvas({ canvasId });
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
            {/* Loading text waits for the project query. */}
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
                  {project.archived_at === undefined ? null : (
                    <span className={styles.itemWhen()}>
                      {formatRelativeTimeNarrow({ iso: project.archived_at, now })}
                    </span>
                  )}
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
              // createProject owns default naming.
              void createProject().then((created) => {
                void goToCanvas({ canvasId: created.id });
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
