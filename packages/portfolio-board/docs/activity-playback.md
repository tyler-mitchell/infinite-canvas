# Activity playback

```tsx
<ActivityGrid
  days={days}
  loading={isFetching}
  replayKey={revision}
  playback={{
    duration: 4,
    cellDuration: 0.016,
    settleDuration: 1.2,
    resetDuration: 0.4,
    waitForPageLoad: false,
    startDelay: 0,
    loop: false,
    impact: 1,
    impactPause: 0,
    particles: { count: 12, lifetime: 0.48, speed: 190, size: 0.85 },
  }}
/>
```

Times are seconds. Scoped Motion animations fade each cell's color layer in sequence.
Each cell starts its effects when its fill finishes; effects end independently.
A bright leading cell leaves a fading wake. `cursorTrail` sets its duration, default `0.2` seconds.
`cursor: false` disables it. `--activity-cursor-color` and `--activity-cursor-fill` set its colors.
Busy days receive more time. `cellDuration` sets the minimum time per cell.
The brightest threshold starts a particle burst and a short source-cell shake and pulse.
Impact cells flash white, then return to green with a fading yellow edge glow.
`--activity-impact-edge` and `--activity-impact-glow` set the edge colors.
Lower green levels receive a small jolt without particles. `minorImpact` sets its maximum
displacement in pixels, default `1.4`; zero disables it. Movement increases with each green level.
`impactDuration` sets the rigid shake and afterglow duration, default `0.65` seconds.
Movement settles within `0.13–0.2` seconds. Each impact varies direction, strength, and timing.
`impactDelay` delays the burst behind the cursor, default `0.09` seconds.
Recent impacts increase shake and particle speed without adding particles or animations.
`comboWindow` defaults to `0.35` seconds. `comboStrength` defaults to `0.18` per recent impact,
capped at three increments. Set `comboStrength: 0` to disable it.
`impact` sets its amplitude; zero disables the shake. Other cells stay still.
Playback continues without a pause. `impactPause` can add an optional hold.

Particles use Motion transform and opacity keyframes. Groups permit overlapping
bursts and scale with playback speed, up to 12. Each group has up to 26 sparks.
A group completes its previous burst before reuse.
No custom frame loop or canvas drawing runs during playback.
Thin streaks and small flecks launch quickly, shorten, and fall as they cool.
`--particle-ember-color` sets the spark color. One brightness/saturation animation per
burst produces the white flash and cooling color. `coolingFilters` overrides its four
CSS filter keyframes. Lifetimes vary within the configured maximum.

`playback={false}` and reduced motion show the final grid without effects.
`particles: false` disables bursts. `settleDuration` delays loop replay.
A changed data set or `replayKey` fades out before the next pass.
Equivalent data does not restart playback. Loading, hidden tabs, and offscreen grids
pause the Motion controls. Keep the component mounted while fetching.
`loadingLabel` defaults to `"Loading activity"`.

`waitForPageLoad` waits for the browser's `load` event. An already loaded page is ready immediately.
`startDelay` adds time before each pass. It defaults to zero and pauses with playback.
The portfolio card waits for page load, then waits another `0.8` seconds before its reveal.
For application data that loads later, keep `loading` true until that data is ready.

After the final impact settles, a shimmer travels from the first cell to the last.
`completionShimmer: false` disables it. `shimmerDuration` defaults to `1.1` seconds;
`shimmerStrength` defaults to `0.45` opacity (range `0–1`).
It uses the existing cursor overlays and colors, with no added elements.
Loop settling starts after the shimmer. Reduced motion skips it.

Narrow grids remove older columns. Particles remain clipped inside the card.
Green cells have a faint reflection along the upper-left curve. It fades in with their fill.
`--activity-cell-highlight` sets its color;
set it to `transparent` to remove it.
`--activity-cell-sheen-opacity` overrides reflection opacity. Defaults rise from `0.5`
to `0.65` and `0.8` on the two brightest levels.
Green cells have a static inner glow, slightly stronger at brighter levels.
`--activity-cell-glow` overrides its color; `transparent` disables it.

## Reusable particles

`ParticleField` renders particle elements in groups (`groups` defaults to 3). `particleBurstSequence`
returns standard Motion sequence entries. Compose them with other animations.

```tsx
import { useAnimate } from "motion/react";
import { ParticleField, particleBurstSequence } from "portfolio-board";

function Example() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  return (
    <div className="relative overflow-clip">
      <button
        onClick={() => {
          if (scope.current) {
            animate(particleBurstSequence({ element: scope.current, x: 80, y: 40 }));
          }
        }}
      >
        Emit particles
      </button>
      <ParticleField ref={scope} count={12} />
    </div>
  );
}
```

Coordinates are CSS pixels from the field's top-left corner. `at` sets the timeline
start in seconds. `group` selects a rendered group for overlapping bursts.
Motion controls own pause, resume, and cancellation. `useAnimate` cleans up on unmount.

| Option     | Default                       |
| ---------- | ----------------------------- |
| `count`    | 12 particles per group        |
| `lifetime` | 0.48 seconds                  |
| `speed`    | 190 pixels per second         |
| `spread`   | 1.5π radians                  |
| `size`     | 0.85 pixels                   |
| `gravity`  | 120 pixels per second squared |

Override the particle color properties to change the palette.
`variation` defaults to `0.15`, varying burst strength by ±15%.
It accepts `0–0.5`; zero disables burst strength variation.
Individual sparks still vary in direction, speed, size, length, and lifetime.
