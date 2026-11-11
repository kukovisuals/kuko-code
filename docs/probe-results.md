# Probe results

Results from `probe.html`, run 2026-11-05 in the user's Chrome through the Claude in Chrome extension,
with the tab visible for all three runs. Nothing here comes from a saved recording.

**Not controlled:** other GPU work on the Mac, including whether a city tab was open in another
window, plus power and thermal state. The attached extension may also add some overhead. The cadence
of about 60 Hz and a device pixel ratio of 2 fit the built-in display, but the display was not
confirmed. The LG was not tested.

## T04: what Chrome exposes

Source: WebGL2 calls in `src/record/probeEnvironment.ts`. Status: measured.

| Field | Value | Meaning |
|---|---|---|
| `browserMajor` | 156 | Matches the brief |
| `glRenderer` | `ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)` | Metal through ANGLE |
| `timerQueryExposed` | true | Stop 6 can try the timer query |
| `parallelCompileExposed` | true | Available, not used yet |
| `timeElapsedBits` | 64 | Durations work, as ANGLE's source suggested (F2) |
| `timestampBits` | 0 | No points in time, as ANGLE's source suggested (F2) |
| `crossOriginIsolated` | true | `performance.now()` can use its finer 5 µs resolution |
| `antialias` | false | Confirmed from `getContextAttributes()` |

## T05: can GPU time be trusted?

**Verdict: the gate passes, so stop 6 can use the timer query, labeled partial.** The `readPixels`
fallback is not needed. Treat the result as a noisy measure of time, not a precise measure of work.

Sources: `TIME_ELAPSED_EXT` for GPU time, and `performance.now()` around draw plus a 1 x 1 `readPixels`
for wall clock. Each timer query condition has 60 warmup frames and 300 sampled frames. All 3,600 sampled
queries returned, with a median lag of 1 frame. `GPU_DISJOINT_EXT` read 0 on every frame, as F4 predicted.

### GPU time rises with shader cost and pixel count

Median `gpuMs` for each run (status: partial).

| Condition | Loops | Pixels | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|---|
| `cost-low` | 32 | 1280 x 800 | 1.29 | 1.41 | 1.27 |
| `cost-mid` | 128 | 1280 x 800 | 4.28 | 5.89 | 4.72 |
| `cost-high` | 512 | 1280 x 800 | 8.83 | 9.31 | 10.04 |
| `cost-mid` | 128 | 640 x 400 | 1.50 | 1.54 | 1.85 |

Ratios calculated from those medians:

| Change | Run 1 | Run 2 | Run 3 | If time were proportional |
|---|---|---|---|---|
| `cost-low` to `cost-mid` | 3.3x | 4.2x | 3.7x | 4x |
| `cost-mid` to `cost-high` | 2.1x | 1.6x | 2.1x | 4x |
| 640 x 400 to 1280 x 800 | 2.9x | 3.8x | 2.6x | 4x |

### It roughly agrees with the wall clock

The ticket doesn't define "roughly", so this is a judgement. The wall clock was higher in all 9
comparisons, by 0.09 to 1.95 ms. A gap of that size matters most for cheap shaders: it is about the
same size as the `cost-low` reading itself. The two timings come from separate frames, so this
compares medians only.

| Shader | Draw + `readPixels` median, runs 1 / 2 / 3 (ms) | Gap above `gpuMs` (ms) |
|---|---|---|
| `cost-low` | 2.77 / 2.66 / 3.22 | 1.48 / 1.25 / 1.95 |
| `cost-mid` | 5.57 / 7.39 / 6.49 | 1.29 / 1.50 / 1.77 |
| `cost-high` | 9.98 / 10.83 / 10.13 | 1.15 / 1.52 / 0.09 |

A second `readPixels` with no new draw had a median of 0.18 to 0.36 ms in runs 1 and 2, and 0.72 to
0.86 ms in run 3. The cause of that shift is unknown.

### The query did not visibly disturb frame cadence

`cost-mid` at 1280 x 800, alternating off and on, 2 blocks each per run, 180 frames per block.
Sources: `requestAnimationFrame` deltas.

| Query | Frames | Median delta (ms) | p95 range (ms) | Frames over 1.5x median |
|---|---|---|---|---|
| Off | 1,080 | 16.67 | 17.29 to 17.47 | 0 |
| On | 1,080 | 16.66 to 16.67 | 17.03 to 17.56 | 1 (73.22 ms, run 1) |

One slow frame can't be attributed to the query. This test ran well under the frame budget, so it
says nothing about a shader that takes close to a full frame. It also shows cadence only: it can't
show whether the query's flushes change the GPU time itself (F2).

## What this means for later tickets

1. **Height is time, not work.** Four times the loops gave only 1.6x to 2.1x the time from `cost-mid`
   to `cost-high`. The wall clock shows the same shape, so this is not a timer query artifact. A likely
   cause is the GPU clocking up under load, but no page API reports clocks, so that is **modeled**, not
   measured. Don't describe a building as "twice the work".
2. **One number isn't enough.** `cost-mid` moved 38% between runs (4.28 to 5.89 ms), and `cost-low`,
   `cost-high` and the 640 x 400 run moved 11% to 23%. With only 3 runs, treat a difference of under
   about 40% at this load as possibly noise.
3. **The spread is wide.** Within a run, `cost-mid` had a p95 of 11.45 to 13.04 ms against a median
   of 4.28 to 5.89 ms. `readPixels` shows similar spikes (p95 12.78 to 13.61 ms), so they are real
   delays, not a query artifact. The source is unknown: other GPU work is one candidate (R8).
4. **The readings are not one tidy peak.** Run 3's `cost-mid` histogram has clusters near 2.5 to 3,
   4 to 4.5 and 5.5 to 6 ms, and its 50-frame block medians went from 3.23 to about 5.5 to 5.9 ms.
   60 warmup frames did not settle it. T13 should keep the distribution, and T16 should compare repeat
   runs, as both already plan.

## T03 check

Source: browser fetch and WebGL2 compile on `probe.html`.

All four shaders compiled and linked as `#version 300 es`. Each fetch returned the raw text, starting
with `#version 300 es`, and `Cache-Control: no-store`. This also settles the T02 question about the
empty `Content-Type`: the raw text arrives correctly in the browser.
