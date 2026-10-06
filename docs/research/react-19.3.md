# React 19.3 reference

## Sources

Retrieved 2026-09-22. These are the React team's API and toolchain specifications,
published with the React implementation. The retrieved pages identify version 19.3.
This is a version-specific reference, not a release changelog.

| ID  | Official reference                                                             | Evidence                            |
| --- | ------------------------------------------------------------------------------ | ----------------------------------- |
| F   | [Fragment](https://react.dev/reference/react/Fragment)                         | FragmentInstance methods and limits |
| E   | [useEffectEvent](https://react.dev/reference/react/useEffectEvent)             | Effect event scope and identity     |
| A   | [Activity](https://react.dev/reference/react/Activity)                         | Hidden state and Effect lifecycle   |
| V   | [ViewTransition](https://react.dev/reference/react/ViewTransition)             | Animation activation and ownership  |
| S   | [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) | Snapshot and scheduling contract    |
| M   | [memo](https://react.dev/reference/react/memo)                                 | Render boundaries and prop equality |
| C   | [Compiler installation](https://react.dev/learn/react-compiler/installation)   | Explicit build integration          |

## Scope

React DOM rendering, observation, Effects, visibility, transitions, and compiler
integration in React 19.3. Assumes knowledge of components, props, state, and Effects.
Excludes Server Components, application data fetching, release history, and browser
performance guarantees. API availability does not establish suitability for a use case.

## Fragment refs

```tsx
import { Fragment, useCallback, type FragmentInstance, type ReactNode } from "react";

export function ObservedGroup({
  children,
  observer,
}: {
  children: ReactNode;
  observer: ResizeObserver;
}) {
  const ref = useCallback(
    (instance: FragmentInstance) => {
      instance.observeUsing(observer);
      return () => instance.unobserveUsing(observer);
    },
    [observer],
  );

  return <Fragment ref={ref}>{children}</Fragment>;
}
```

Manual example; not executed. The caller owns the observer.

`FragmentInstance` supports observation, event listeners, focus, DOM position,
client rectangles, and scrolling. Observation and rectangle methods operate on
first-level DOM children. Focus searches nested children. Text nodes cannot be
observed. A Fragment adds no CSS box: it cannot supply padding, overflow, flex
layout, or one aggregate intrinsic size. Explicit `<Fragment>` syntax is required
for a ref or key. [F]

## Effect Events

```tsx
const onConnected = useEffectEvent(() => notify(theme));

useEffect(() => {
  const connection = connect(roomId);
  connection.on("connected", onConnected);
  return () => connection.disconnect();
}, [roomId]);
```

Manual API slice; `connect` and `notify` belong to the caller.

The callback sees the latest committed render values when called. An Effect
Event belongs to Effects or other Effect Events in the same component. It is
not a general event-handler prop or a replacement for reactive dependencies.
Its identity changes between renders; it is excluded from dependency arrays.
Values that must resynchronize an Effect remain dependencies. [E]

## Visibility and state retention

```tsx
<Activity mode={visible ? "visible" : "hidden"}>
  <Panel />
</Activity>
```

Manual API slice. Hidden Activity retains state and DOM, applies `display: none`,
and cleans up Effects. Revealing it recreates Effects. Hidden children can still
render for new props at lower priority. Hidden Activity is therefore neither
unmounting nor a guarantee of zero work. Effect cleanup must release subscriptions
and external resources correctly. [A]

## View transitions

```tsx
<ViewTransition>
  <Page />
</ViewTransition>
```

Manual API slice. Transitions, Suspense, and deferred values can activate this
boundary. An ordinary immediate state update does not activate it.
React owns `startViewTransition` coordination. Explicit names serve shared
element transitions; other boundaries receive generated names. The animation
uses snapshots rather than independently animating every descendant's position.
This differs from continuous layout or gesture animation. [V]

## External stores

```tsx
const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
```

Manual API slice. `subscribe` returns cleanup. An unchanged store must return
the same snapshot; changed snapshots are compared with `Object.is`. Snapshots
are immutable. Changing `subscribe` identity causes resubscription.
The server snapshot must match during hydration.

External store mutations cannot be marked as non-blocking Transition updates.
If a snapshot changes during a Transition, React can restart the update as
blocking to maintain consistency. Wrapping a store write in `startTransition`
does not change this contract. [S]

## Memoization and compilation

```tsx
const Row = memo(RowView);
```

`memo` can skip parent-driven renders when props are equal. Local state and
consumed context still cause updates. New object, array, or function props can
defeat the default comparison. Memoization is an optimization, not a correctness
boundary. React Compiler can provide equivalent memoization. [M]

For Vite with `@vitejs/plugin-react` 6 or later, the documented compiler setup is:

```ts
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

const plugins = [react(), babel({ presets: [reactCompilerPreset()] })];
```

Reference configuration, not project configuration. Compiler installation and
build integration are separate from the React runtime. Earlier plugin versions
use a different Babel configuration. Compiler output or the DevTools compiler
badge provides evidence that a component was compiled. A runtime
`react/compiler-runtime` export alone does not provide that evidence. [C]
