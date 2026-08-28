#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { defineCommand, runMain } from "citty";
import {
  inspectExportedMigrations,
  scanDefinitions,
  type SurrealInspectorReport,
} from "surreal-inspector/core";

import { loadManifest } from "./manifest.ts";

/**
 * Offline inspector commands. An embedded SurrealDB lives in IndexedDB, which exists only inside a
 * page, so these operate on text: the SurQL corpus, an export, or a saved report.
 *
 * Live inspection is `window.__surreal` in the running app. `report` reads its output:
 *
 * ```sh
 * copy(JSON.stringify(await window.__surreal.report()))
 * surreal-inspect report --file report.json
 * ```
 *
 * Every command takes `--json`.
 */

const jsonFlag = {
  description: "Emit the result as JSON rather than as text.",
  type: "boolean",
} as const;

const manifestFlag = {
  description: "Path to a SurQL manifest.json. Its file paths resolve relative to it.",
  required: true,
  type: "string",
} as const;

function emit(json: boolean, value: unknown, lines: readonly string[]) {
  console.log(json ? JSON.stringify(value, null, 2) : lines.join("\n"));
}

const scan = defineCommand({
  args: { json: jsonFlag, manifest: manifestFlag },
  meta: {
    description: "List every DEFINE a SurQL corpus declares, and what the scan cannot model.",
    name: "scan",
  },
  run: async ({ args }) => {
    const manifest = await loadManifest(args.manifest);
    const perFile = manifest.stages.flatMap((stage) =>
      stage.files.map((file) => ({
        definitions: scanDefinitions(file.source),
        path: file.path,
        stage: stage.name,
      })),
    );
    const all = perFile.flatMap((file) => file.definitions);
    const seen = new Map<string, string[]>();

    for (const file of perFile) {
      for (const definition of file.definitions) {
        seen.set(definition.id, [...(seen.get(definition.id) ?? []), file.path]);
      }
    }

    /*
     * Two files defining the same thing is not automatically wrong — but with `IF NOT EXISTS` it
     * means only the first one ever takes effect, so it is always worth knowing about.
     */
    const duplicates = [...seen.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([id, paths]) => ({ id, paths }));
    const byKind = Object.fromEntries(
      [...new Set(all.map((definition) => definition.kind))]
        .toSorted()
        .map((kind) => [kind, all.filter((definition) => definition.kind === kind).length]),
    );

    emit(args.json, { byKind, definitions: all, duplicates, files: perFile.length }, [
      `manifest v${String(manifest.version)} — ${String(perFile.length)} files, ${String(all.length)} definitions`,
      ...Object.entries(byKind).map(([kind, count]) => `  ${kind.toLowerCase()}: ${String(count)}`),
      ...(duplicates.length === 0
        ? []
        : [
            "",
            `${String(duplicates.length)} defined in more than one file (only the first takes effect under IF NOT EXISTS):`,
            ...duplicates.map((entry) => `  ${entry.id} — ${entry.paths.join(", ")}`),
          ]),
    ]);
  },
});

const drift = defineCommand({
  args: {
    export: {
      description: "Path to a .surql export taken from the live database.",
      required: true,
      type: "string",
    },
    json: jsonFlag,
    manifest: manifestFlag,
  },
  meta: {
    description: "Compare a SurQL export against the corpus that is supposed to have produced it.",
    name: "drift",
  },
  run: async ({ args }) => {
    const manifest = await loadManifest(args.manifest);
    const report = inspectExportedMigrations(await readFile(args.export, "utf8"), manifest);

    emit(args.json, report, [
      `manifest v${String(manifest.version)} against ${args.export}`,
      `  missing:    ${String(report.missing.length)}`,
      `  redefined:  ${String(report.redefined.length)}`,
      `  undeclared: ${String(report.undeclared.length)}`,
      ...(report.missing.length === 0
        ? []
        : [
            "",
            "Declared by the corpus, absent from the export:",
            ...report.missing.map(
              (entry) => `  ${entry.definition.id} — ${entry.origin ?? "unknown file"}`,
            ),
          ]),
      ...(report.redefined.length === 0
        ? []
        : [
            "",
            "Present on both sides with different types:",
            ...report.redefined.map(
              (entry) => `  ${entry.id} — corpus ${entry.declared}, export ${entry.live}`,
            ),
          ]),
      ...(report.undeclared.length === 0
        ? []
        : [
            "",
            "In the export, declared by no corpus file:",
            ...report.undeclared.map((entry) => `  ${entry.definition.id}`),
          ]),
      ...(report.unmodelled.length === 0
        ? []
        : [
            "",
            `Files carrying REMOVE, whose effect this scan does not model: ${report.unmodelled.join(", ")}`,
          ]),
    ]);
  },
});

const report = defineCommand({
  args: {
    file: {
      description: "Path to JSON captured from window.__surreal.report().",
      required: true,
      type: "string",
    },
    json: jsonFlag,
  },
  meta: {
    description: "Summarise a report captured from the running app's inspector handle.",
    name: "report",
  },
  run: async ({ args }) => {
    const captured = JSON.parse(await readFile(args.file, "utf8")) as SurrealInspectorReport;
    const integrity = captured.integrity;

    emit(args.json, captured, [
      `${captured.connection.endpoint} — ${captured.connection.engine ?? "engine unknown"} — ${captured.connection.open ? "open" : "not open"}`,
      `taken ${new Date(captured.generatedAt).toISOString()}`,
      "",
      ...(captured.catalogue === null
        ? ["No catalogue was read."]
        : [
            `${String(captured.catalogue.tables.length)} tables, ${String(captured.catalogue.functions.length)} functions`,
            ...captured.counts.map(
              (count) => `  ${count.table}: ${count.records.toLocaleString()} records`,
            ),
          ]),
      "",
      ...(integrity === null
        ? ["Integrity was not checked."]
        : [
            `Integrity: ${String(integrity.findings.length)} findings, ${String(integrity.gaps.length)} gaps of ${String(integrity.checked)} checks`,
            ...integrity.findings.map(
              (finding) =>
                `  ${finding.check}: ${finding.detail} — ${String(finding.offenders.length)}${finding.truncated ? "+" : ""} records`,
            ),
            ...integrity.gaps.map((gap) => `  gap ${gap.check}: ${gap.detail} — ${gap.reason}`),
          ]),
      "",
      `Storage: ${captured.storage.usageBytes === null ? "unknown" : `${String(captured.storage.usageBytes)} bytes used`} of ${captured.storage.quotaBytes === null ? "unknown" : `${String(captured.storage.quotaBytes)} bytes`} (origin-wide)`,
      ...captured.storage.databases.map(
        (database) =>
          `  ${database.name}: ${database.stores.map((store) => `${store.name}=${String(store.entries ?? "?")}`).join(", ")}`,
      ),
      /*
       * Last, and never omitted when non-empty. Everything above can be absent for two reasons —
       * there was nothing, or nothing could be established — and this is the only thing that tells
       * them apart.
       */
      ...(captured.unavailable.length === 0
        ? []
        : [
            "",
            "Could not be established:",
            ...captured.unavailable.map((entry) => `  ${entry.what}: ${entry.reason}`),
          ]),
    ]);
  },
});

void runMain(
  defineCommand({
    meta: {
      description:
        "Inspect a SurrealDB corpus, export, or captured report. The live database is reached through window.__surreal in the running app.",
      name: "surreal-inspect",
    },
    subCommands: { drift, report, scan },
  }),
);
