export type SelectionTarget = {
  type: string;
  id: string;
  kind?: string;
  data?: unknown;
};

export type TargetKey = `${SelectionTarget["type"]}:${string}`;

export type Selection = {
  targets: Record<TargetKey, SelectionTarget>;
  anchor: TargetKey | null;
};

export type SelectionMode = "replace" | "add" | "toggle" | "remove";

export const getTargetKey = ({ type, id }: SelectionTarget): TargetKey => `${type}:${id}`;

export function getSelection({
  selection,
  targets,
  mode,
}: {
  selection: Selection;
  targets: SelectionTarget[];
  mode: SelectionMode;
}): Selection {
  const incoming: Selection["targets"] = Object.fromEntries(
    targets.map((target) => [getTargetKey(target), target]),
  );
  const operations = {
    replace: () => incoming,
    add: () => ({ ...selection.targets, ...incoming }),
    remove: () =>
      Object.fromEntries(Object.entries(selection.targets).filter(([key]) => !(key in incoming))),
    toggle: () =>
      Object.fromEntries(
        Object.entries({ ...selection.targets, ...incoming }).filter(
          ([key]) => !(key in selection.targets && key in incoming),
        ),
      ),
  };
  const next = operations[mode]();
  const last = targets.at(-1);
  const anchor = last === undefined ? null : getTargetKey(last);
  return { targets: next, anchor: anchor !== null && anchor in next ? anchor : null };
}
