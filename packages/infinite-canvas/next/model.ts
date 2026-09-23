import {
  beginBatch,
  endBatch,
  observable,
  type Observable,
  type ObservableObject,
  type ObservablePrimitive,
} from "@legendapp/state";
import { undoRedo } from "@legendapp/state/helpers/undoRedo";
import {
  TraversalError,
  type,
  type ArkError,
  type ArkErrors,
  type Module,
  type Type,
} from "arktype";
import { createCameraController } from "./camera";

declare global {
  interface ArkEnv {
    prototypes(): Observable<unknown>;
  }
}

export type Result<Value> = { data: Value; error: null } | { data: null; error: Error | ArkErrors };

export type MutationResult = void | Error | ArkErrors;

export function batch<Value>(run: () => Value): Value {
  beginBatch();
  try {
    return run();
  } finally {
    endBatch();
  }
}

type Context = { computed: ObservableObject<{}>; actions: object };

type Operation = ((...args: never[]) => unknown) & {
  params: type.Any<[unknown]>;
};

type ActionResult<Value> =
  Value extends PromiseLike<unknown> ? Promise<Awaited<Value> | Error | ArkErrors> : Value;

type Actions<Operations extends Record<string, Operation>> = {
  [Key in keyof Operations]: {
    name: Key;
    input: Type<Parameters<Operations[Key]>[0]>;
    /** Null when the action would run; otherwise why it would not. */
    check(input: Parameters<Operations[Key]>[0]): string | null;
    canRun(input: Parameters<Operations[Key]>[0]): boolean;
    run(
      input: Parameters<Operations[Key]>[0],
    ): ActionResult<ReturnType<Operations[Key]>> | Error | ArkErrors;
  };
};

type CommandDefinition = {
  action: {
    name: string;
    input: type.Any;
    check(input: never): string | null;
    canRun(input: never): boolean;
    run(input: never): unknown;
  };
  label: string;
  icon: string;
  description?: string;
  scope?: "selection" | "canvas";
  surface?: "edit" | "view" | "none";
};

type CommandData<Value> = Value extends Error | ArkErrors
  ? never
  : Value extends void
    ? null
    : Value;

type Commands<Definitions extends Record<string, CommandDefinition>> = {
  [Key in keyof Definitions]: Omit<Definitions[Key], "action"> & {
    action: Definitions[Key]["action"]["name"];
    input: Definitions[Key]["action"]["input"];
    check: Definitions[Key]["action"]["check"];
    canRun: Definitions[Key]["action"]["canRun"];
    run(
      input: Parameters<Definitions[Key]["action"]["run"]>[0],
    ): Promise<Result<CommandData<Awaited<ReturnType<Definitions[Key]["action"]["run"]>>>>>;
  };
};

type Computed<Definitions> = {
  [Key in keyof Definitions]: Observable<Definitions[Key]>;
};

function inputError(error: ArkError): ArkError {
  return error.transform(({ prefixPath: _prefixPath, relativePath: _relativePath, ...input }) => {
    const path = error.path[0] === 0 ? error.path.slice(1) : error.path;
    if (input.code === "union" || input.code === "intersection") {
      return { ...input, path, errors: input.errors.map(inputError) };
    }
    return { ...input, path };
  });
}

function failure(error: unknown): Error | ArkErrors {
  if (error instanceof TraversalError) return error.arkErrors.transform(inputError);
  if (error instanceof Error || error instanceof type.errors) return error;
  return new Error("Model operation failed.", { cause: error });
}

class Model<Options, Current extends Context> {
  readonly create: (options: Options) => Current;

  constructor(create: (options: Options) => Current) {
    this.create = create;
  }

  configuration<Configuration>(define: (options: Options) => Configuration) {
    return new Model((options: Options) => ({
      ...this.create(options),
      configuration: define(options),
    }));
  }

  history<Value>(
    define: (context: Current) => { state: ObservablePrimitive<Value>; limit?: number },
  ) {
    return new Model((options: Options) => {
      const context = this.create(options);
      const { state, limit } = define(context);
      return { ...context, history: undoRedo(state, { limit }) };
    });
  }

  camera(define: (context: Current) => Parameters<typeof createCameraController>[0]) {
    return new Model((options: Options) => {
      const context = this.create(options);
      return { ...context, camera: createCameraController(define(context)) };
    });
  }

  computed<Definitions extends Record<string, unknown>>(define: (context: Current) => Definitions) {
    return new Model<
      Options,
      Omit<Current, "computed"> & {
        computed: Current["computed"] & Computed<Definitions>;
      }
    >((options) => {
      const context = this.create(options);
      context.computed.assign(define(context));
      return {
        ...context,
        computed: context.computed as Current["computed"] & Computed<Definitions>,
      };
    });
  }

  inputs<Inputs extends Module>(define: (context: Current) => Inputs) {
    return new Model<Options, Omit<Current, "inputs"> & { inputs: Inputs }>((options) => {
      const context = this.create(options);
      return { ...context, inputs: define(context) };
    });
  }

  actions<const Operations extends Record<string, Operation>>(
    define: (context: Current) => Operations,
  ) {
    return new Model<
      Options,
      Omit<Current, "actions"> & {
        actions: Current["actions"] & Actions<Operations>;
      }
    >((options) => {
      const context = this.create(options);
      const actions = Object.fromEntries(
        Object.entries(define(context)).map(([name, operation]) => {
          const check = (input: unknown) => {
            try {
              const result = operation.params([input]);
              return result instanceof type.errors ? result.transform(inputError).summary : null;
            } catch (error) {
              if (error instanceof TraversalError)
                return error.arkErrors.transform(inputError).summary;
              console.warn("Action availability failed.", { action: name, error });
              return "The canvas refused this input.";
            }
          };
          return [
          name,
          {
            name,
            input: operation.params.in.get<0>(0),
            check,
            canRun: (input: unknown) => !(operation.params([input]) instanceof type.errors),
            run(input: unknown) {
              try {
                const result: unknown = Reflect.apply(operation, undefined, [input]);
                return result instanceof Promise ? result.catch(failure) : result;
              } catch (error) {
                return failure(error);
              }
            },
          },
        ];
        }),
      ) as Actions<Operations>;
      return { ...context, actions: { ...context.actions, ...actions } };
    });
  }

  commands<const Definitions extends Record<string, CommandDefinition>>(
    define: (context: Current) => Definitions,
  ) {
    return new Model((options: Options) => {
      const context = this.create(options);
      const commands = Object.fromEntries(
        Object.entries(define(context)).map(([name, command]) => {
          const run = command.action.run.bind(command.action);
          const fail = (error: Error | ArkErrors) => {
            console.warn("Command failed.", {
              command: name,
              error: error instanceof type.errors ? error.summary : error,
            });
            return { data: null, error };
          };
          return [
            name,
            {
              ...command,
              action: command.action.name,
              input: command.action.input,
              check: command.action.check.bind(command.action),
              canRun: command.action.canRun.bind(command.action),
              async run(input: unknown) {
                try {
                  const data: unknown = await Reflect.apply(run, undefined, [input]);
                  if (data instanceof Error || data instanceof type.errors) return fail(data);
                  return { data: data === undefined ? null : data, error: null };
                } catch (error) {
                  return fail(failure(error));
                }
              },
            },
          ];
        }),
      ) as Commands<Definitions>;
      return { ...context, commands };
    });
  }

  activate(start: (context: Current) => void) {
    return new Model((options: Options) => {
      const context = this.create(options);
      start(context);
      return context;
    });
  }
}

export function model<Options, State extends type.Any>(definition: {
  state: State;
  initial(options: Options): NoInfer<State["inferIn"]>;
}) {
  return new Model((options: Options) => ({
    state: observable(definition.state.assert(definition.initial(options))),
    computed: observable({}),
    actions: {},
  }));
}
