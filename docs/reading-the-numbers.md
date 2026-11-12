# Reading the numbers

How to read the focus panel in the city (`index.html`) and the experiments page (`experiments.html`), what an
engineer can do with each number, and how to use them to make a shader faster.

**Written:** 2026-11-12, after Output 0 closed. The shader on both pages is Day 564 (`shaders/day564-image.glsl`)
on the M2, Chrome 157, built-in display at 60 Hz. Every number below comes from `docs/backlog.md` findings, a file in
`data/`, or the panel snapshot the user pasted on 2026-11-12. Sources are named on each one.

## 1. The three labels

Every number has one. Read the label before the number.

| Label | Meaning | How much to trust it |
|---|---|---|
| **measured** | A browser API reports this value directly. | Trust the value. Still check the spread. |
| **partial** | A real measurement, but a proxy, or it includes other work. The source says what else is in it. | Trust the trend. Read the source to see what else is counted. |
| **modeled** | Calculated or inferred. No measurement behind it. | Only as good as its inputs. Never quote it as measured. |

A number with no label and no source is not allowed on either page.

## 2. The focus panel: "One frame against its budget"

The question this panel answers: **does one frame of this shader fit in the time the display gives it, and how much
is left over?** On a 60 Hz display the budget is 1000 / 60 = 16.67 ms (`data/hardware-map.m2.json`, calculated).

Snapshot from 2026-11-12, live, with the city drawing on the same GPU:

| Row | Value | Label | What it is | How to read it |
|---|---|---|---|---|
| GPU time per frame, median | 3.15 ms | partial | `TIME_ELAPSED_EXT` around the shader's one draw per frame, after warmup (`src/city/live/liveRecorder.ts`). | The typical GPU cost of one frame. A time range, not busy time: other GPU work that runs inside that range is counted too. |
| GPU time per frame, p95 | 3.44 ms | partial | Same readings, 95th percentile. | 95% of frames cost this or less. Close to the median means steady. Far above it means some frames spike. |
| GPU time per frame, Instruments (city closed) | 0.67 ms | partial | Fragment time of the shader's own pass in a Metal System Trace of Chrome's GPU process, `program.html` alone, n = 404 (`data/imports/instruments.json`). | **The shader's real cost.** Partial because the pass is picked by its shape: ANGLE labels nothing. |
| Share of frame budget | 18.9 % | modeled | 3.15 / 16.67. | How much of the frame this shader takes. Under 100% fits. |
| Headroom per frame | 13.52 ms | modeled | 16.67 − 3.15. | Time left for everything else the GPU must draw in that frame. |
| Frame interval, median | 16.67 ms | partial | Median time between `requestAnimationFrame` callbacks. | Exactly the budget means frames arrive on every vsync. 33.3 ms would mean every other one is missed. |
| Frame interval, p95 | 17.65 ms | partial | Same, 95th percentile. | Within 1 ms of vsync, so no frame was dropped in 95% of the window. Compositor and scanout time are not in it. |
| JS calls per frame | 0.01 ms | measured | `performance.now()` around one frame of WebGL calls: 4 uniforms and 1 draw. | The CPU cost of asking. Calls only queue work, so this stays tiny however heavy the shader is. |
| Build, once: compile + link + first draw | 2.04 ms | partial | Sum of the blocking `COMPILE_STATUS`, `LINK_STATUS` and first-draw readings. Each includes call overhead. | The one-time hitch before the first frame. Paid once per load, not per frame. Cache state unknown. |
| Metal fragment compile, Instruments | 2.50 ms | partial | Apple's Metal compiler, fragment stage, one reload, n = 1 (`data/imports/instruments.json`). | Apple's share of the build. From a different load than the row above, so don't add or subtract the two. |

### What this snapshot says

1. **It fits easily.** 3.15 ms of 16.67 ms, and frames arrive on every vsync.
2. **Most of the 3.15 ms is not the shader.** Alone, the same shader is 0.67 ms (Instruments) and 0.705 ms (the
   page's own timer query, over the same seconds). The two tools agree within 5% (T38 findings). The rest is the city's
   own drawing, which lands inside the timer's range. Earlier live readings were 1.45 ms and 4.1 ms for the same
   reason. **The live number is an upper bound. The Instruments row is the shader.**
3. **The shader alone uses about 4% of the budget** (0.67 / 16.67, modeled). Speed work on Day 564 won't change the
   frame rate. It would only free GPU time for other work.
4. **The CPU is not the problem.** 0.01 ms of JS against 0.67 to 3.15 ms of GPU is a gap of about 70x to 300x.
   Making the JS faster can't help this frame.
5. **The build hitch is small:** about 2 ms. Day 442 read 85.6 ms on one load (T25), which a user would feel.

"All numbers" in the panel head shows every stop, block and process. Those are the same readings in more detail.

## 3. The experiments page

`experiments.html` answers a different question: **where inside the shader does the work go?** No browser API can
time one line of a shader, so the page shows what it can: how often each block ran, where on screen the GPU time went,
and the text the compiler produced. It draws one frozen frame (iTime = 4 s, 1280 x 800). **Close the city tab first.**

Day 564 readings below come from `data/experiments/day564.json`, saved 2026-11-11.

### 3.1 Your code, line by line (measured, one column modeled)

A counting copy of the shader adds one counter per `{ }` block and writes counts instead of a color.
`readPixels` reads them back. The copy takes the same branches as the real shader, so the counts are exact.

| Column | Meaning | Day 564 |
|---|---|---|
| **runs / frame** | Times the block ran, summed over all 1,024,000 pixels. | `W` 5,814,400. Loop body 4,096,000. `if` body 753,600. |
| **max / pixel** | The most times it ran for one pixel. | `W` 6, loop 4, `if` 2. |
| **pixels** | Share of pixels where it ran at all. | `if` body ran in 61% (628,800 pixels). |
| **lanes waiting** (modeled) | The GPU runs 32 pixels together as a SIMD group. A group goes through a block as often as its busiest pixel. This is the share of those slots whose pixel was already done. | 0% for every block. |

How to read it:

- **runs / frame is your work count.** Multiply it by what the block does and you have the frame's work. The hot spot
  is the block with the biggest count times the most expensive body. In Day 564 that is `W`: 5.68 calls per pixel.
- **max / pixel against the average shows uneven work.** `W` averages 5.68 with a max of 6. `&&` skips the second `W`
  when the first is false, so it runs fewer than 8 times (T34 findings).
- **lanes waiting is wasted GPU time from branches.** If neighbors in a group take different paths, the fast ones sit
  idle. 0% means Day 564's branches are the same for all 32 pixels of each modeled group. A ray marcher, where
  neighboring rays stop at different steps, would read higher. The 32-wide group is a community figure
  (metal-benchmarks). The 8 x 4 layout on screen is our model.
- Click a line to see **where its block ran** on screen, as a heat map.

### 3.2 GPU time by screen tile (partial)

One timer query per 80 x 80 tile, using a scissor, 12 rounds. An empty one-line shader is timed in the same tiles.

- **Whole screen in one draw: 0.35 ms median** (0.31 to 0.49, 12 rounds). This is the frozen frame, not the animating
  page, so don't compare it directly with the 0.67 ms from Instruments.
- **The 160 tile medians add up to 20.44 ms, not 0.35 ms.** An empty shader costs about 0.094 ms per tile, so most
  of the sum is the fixed cost of a draw.
- **Rule:** the tile map only means something when the shader's per-tile cost is well above the empty shader's.
  For Day 564 it mostly shows overhead. For a heavy shader like Day 442 it would show where the cost sits.

### 3.3 The compiler

Your GLSL passes through two compilers. Chrome's ANGLE rewrites it as Metal source. Apple's compiler then makes GPU
code. A page can read ANGLE's output (`WEBGL_debug_shaders`, measured) and nothing after it (modeled).

What it showed (T28 and T34 findings):

- Functions you define but never call (`sdLink`, `arrow` in Day 442) are removed. They cost nothing per frame.
- `#define` values are pasted in before translation. `AA` appears 0 times in the Metal text.
- Every `for` loop becomes a `while` loop.
- Variables you never set are set to zero for you (`_us = float2(0.0f, 0.0f)` in Day 564).
- Whether Apple's compiler unrolls loops or moves work out of them can't be seen from a page.

### 3.4 Checks

The page checks its own readings, so a broken counter or timer shows up as a failure, not as a wrong picture. Day 564
passed all four: `mainImage` ran exactly once per pixel, `GPU_DISJOINT_EXT` read true 0 times, 0 timer queries were
lost, and the tab stayed visible. **If any check fails, ignore the rest of the page for that run.**

## 4. How an engineer uses these numbers

Ask these questions in order. Each one says which number answers it.

1. **Does the frame fit?** Share of budget and frame interval. If the interval median sits at the budget and the p95
   is close, frames are on time.
2. **Is it GPU or CPU?** Compare JS calls per frame with GPU time per frame. If the GPU number is far bigger, only
   shader or pixel changes will help.
3. **Am I measuring the shader or its neighbors?** Compare the live GPU time with the Instruments row, or run
   `program.html` alone. If they differ a lot, something else is drawing on the same GPU. Fix the measurement first.
4. **Is it steady?** Compare p95 with the median. A wide gap means spikes, which users feel as stutter even when the
   median fits.
5. **Is there a hitch at load?** The build row. Tens of ms means a visible pause before the first frame.
6. **Where is the work?** The experiments page counts. Biggest runs / frame first, then lanes waiting.

For a renderer, the share of budget is the useful number to plan with. It tells you how many passes like this one fit
in a frame next to the rest of the scene.

## 5. How to make a shader faster with them

### The loop

1. **Measure alone first.** City tab closed. Use `program.html`, the experiments page or an Instruments trace.
2. **Find the biggest count** on the experiments page. That block is where a saving can be large.
3. **Change one thing in a copy.** Never edit the user's file.
4. **Time the whole frame again, many times, with a control.** Interleave the original, the change and a no-change
   copy. Trust a saving only if every round agrees on its sign and it is bigger than the control's swing.
5. **Compare the pictures.** A cheaper shader that looks different is a different shader, not a saving.

Step 4 matters because the noise is big. In T29 the no-change control swung by 9 to 15 ms in one round on a 33 to
42 ms shader. In T05, `cost-mid` moved 38% across 3 runs. One reading proves nothing.

### What the evidence says works

From T29 (Day 442, 6 rounds per run, 2 runs, all partial):

| Change | Saving | Picture | Verdict |
|---|---|---|---|
| `AA 2` → `AA 1` (4 rays per pixel → 1) | 19 to 22 ms of 33 to 42 ms, every round agreed | 10.9% of pixels moved, by 2.7 of 255 levels on average | **The one clear win.** |
| 60 → 30 march steps | 10 to 15 ms, agreed in one run | 35% of pixels moved | Cheaper, but changes the look. |
| 5 → 3 folds | −3 to 11 ms, no agreement | 58% of pixels moved | Not proven, and changes the look. |
| No normal | 4 to 8 ms | 45% of pixels moved | Changes the look. |
| Fold matrix built in JS | about 2 ms, inside the noise | identical | No clear saving. The compiler may already do it once (inferred). |

What this teaches:

- **Work per pixel is the big lever.** Samples per pixel, loop counts and steps all multiply. The counts on the
  experiments page show exactly how many times each one ran.
- **Time is not proportional to work.** 4x fewer rays cut the time by about half, not by 4. In T05, 4x the loops gave
  1.6x to 2.1x the time. A rising GPU clock is a likely cause (modeled). Always measure the change. Don't calculate it.
- **Keep neighbors on the same path.** If lanes waiting is high, the GPU idles inside groups. Make branches depend on
  things that change slowly across the screen, or end loops at the same step for nearby pixels.
- **Short-circuit the expensive test.** `&&` and `||` skip the second call when the first decides. Day 564's `W` runs
  5.68 times per pixel instead of 8 because of it.
- **Don't hand-optimize what the compiler already does.** Dead functions and `#define` constants are handled before
  Metal sees the text. Check the compiler panel before spending time on them.
- **Moving uniform work to JS didn't help, measurably.** Work that is the same for every pixel can be done once on the
  CPU and passed in as a uniform, but T29 found no clear saving. Idle CPU cores can't take pixel work from the GPU (T30).
- **Load-time hitch:** compile in the background. `KHR_parallel_shader_compile` is exposed on this Mac
  (`data/experiments/day564.json`, environment) and lets the page check `COMPLETION_STATUS` instead of blocking.

### For Day 564 today

At about 0.67 ms alone, 4% of the budget, with 0% lanes waiting, it doesn't need speed work to hold 60 Hz. The
bottleneck in the live view is the city drawing beside it (T30, T38).

## 6. What these numbers can't tell you

- **The time of one line.** No browser API reports it. Counts are the closest a page gets.
- **Why the GPU is slow:** math, memory, registers or occupancy. A page has no GPU counters. Native tools have some,
  and they're out of scope for v0.
- **Power, heat and clock speed.** Not readable from a page. `powermetrics` needs root.
- **Apple's compiler output.** Only ANGLE's Metal text is readable.
- **Busy time.** `TIME_ELAPSED_EXT` is a time range. Anything else on the GPU inside it is counted.
- **Cache state.** Whether a build hit Chrome's program cache is unknown (`cacheState: unknown`).
- **Live numbers are not recording quality.** The city draws on the same GPU. A clean recording needs the city tab
  closed, and the recorder for stops 4 to 8 was never built (Output 0 closed as-is).

## 7. What carries over to WebGPU (Output 1)

- **Timer queries.** WebGPU's `timestamp-query` feature times a pass the same way. The rules stay: medians, p95,
  spread, a control, and measuring alone.
- **The labels.** measured, partial and modeled apply to every number the viewer shows.
- **Pass labels.** ANGLE labels nothing, so T38 had to guess which pass was the shader. WebGPU lets you set a `label`
  on encoders and passes. Whether Chrome passes those labels on to Instruments is expected but not checked.
- **Background compiles.** WebGPU's `createRenderPipelineAsync` does what `KHR_parallel_shader_compile` does here.
- **Counting work per pixel.** The counting-copy trick works the same in WGSL. A compute shader could write the counts
  to a storage buffer instead of the color.
