# Shader Pipeline City v0: backlog

The single source of truth for building v0. A new session should be able to work
from this file alone, without any earlier conversation.

**Written:** 2026-11-05, at the end of Phase 0 (research and blueprint).
**Repo state at that point:** only this file. No app code exists yet.

## 1. How to work through this backlog

**The approval gate.** The user's rule: no app code until they reply "approved".
Check the board below. If the gate is still open, stop and ask for approval
before starting any ticket.

**For every ticket:**

1. Read the ticket and the reference sections it names.
2. Before writing code, explain the plan and the "Teach" points in plain language.
   The user is a frontend dev (JS, React, Node, GLSL, Three.js) and wants to
   understand every part before it is built.
3. Do only that ticket. If something else turns up, add it to section 5.
4. Check every "Done when" item and report the real result, including failures.
5. Tick the ticket on the board and add any new findings to this file.
6. Stop and wait for the user. Commit only when they ask.

## 2. Board

**Gate:** [x] User approved on 2026-11-05, in the words "start with tickets 1 and 2"

**Foundation**
- [x] T01 Write CLAUDE.md
- [x] T02 Scaffold the project
- [x] T03 Add reference shaders

**Prove the timers (T05 is a gate)**
- [x] T04 Probe the environment
- [x] T05 Prove GPU timing works (passed: see `docs/probe-results.md`)
- [ ] T06 Test the shader caches

**Data contract**
- [x] T07 Schema, types and validator
- [x] T08 Hardware map JSON

**Recorder**
- [ ] T09 Stop 1: fetch the shader
- [ ] T10 Stops 2 and 3: call time and round trip
- [ ] T11 Stop 4: compile time
- [ ] T12 Stop 5: link and first draw
- [ ] T13 Stop 6: GPU time per frame
- [ ] T14 Stop 7: SIMD group model
- [ ] T15 Stop 8: refresh cadence
- [ ] T16 Run protocol and save

**City**
- [x] T17 Ground blocks
- [x] T18 Labels with sources
- [x] T19 Stop buildings from a recording (re-check with a real recording after T16)
- [x] T20 Roads for both trips
- [x] T21 GPU district and stop 7 zoom (re-check with a real recording after T16)
- [x] T22 Replay and display comparison (re-check with real recordings after T16)

The city was built ahead of T03 to T06 and T09 to T16, at the user's request, to check the
direction. No real recording exists yet, so T19, T21 and T22 were only checked with invented
placeholder numbers and a test fixture.

**Added at the user's request**
- [x] T23 Live view of the user's shader (Day 560)
- [x] T24 Live view inside the city: real traffic, real hardware readings, Day 560 embedded
- [x] T25 Day 442 as the live program (one pass, one draw per frame)
- [ ] T26 Show where the shader executes, in levels you can click into

**The two questions (user, 2026-11-11).** Q1: can I follow the shader from the files on disk down to the
hardware? Q2: can I see which code makes the GPU slow, and what hardware is sitting idle?
Suggested order: T27, T29, T28, T30, then T26. The user hasn't confirmed the order.
- [x] T27 Q1: the whole path, from disk to pixels, with the CPU cores drawn
- [x] T28 Q1 + Q2: what the compiler turned the shader into (stop 4 is measured in live mode: see findings)
- [x] T29 Q2: which code costs GPU time, by switching parts off and timing again (only `AA` gave a clear saving: see findings)
- [x] T30 Q2: spare room, and whether the shader can reach it (the GPU reads 100% even with the program stopped: see findings)
- [ ] T31 Root readings from `powermetrics`: GPU clock, power, per-core frequency (feeds T27 and T30)
- [ ] T32 Replace T29's guessed variants: show how each line of Day 442 compiles and runs on the hardware, no suggestions
- [x] T33 Chip-like look for the city: real material colors, same primitive shapes (user request, 2026-11-11)

## 3. Open decisions

The user has not answered these yet. Build with the default unless they say otherwise.
Update this table when they answer.

| ID | Question | Default | Affects |
|---|---|---|---|
| D1 | How does the GPU district show a heavier shader? | All 10 cores light together. Fill = `min(gpuMs / frameBudgetMs, 1)`, tagged modeled. Replaces the brief's "lights more of each core". | T21 |
| D2 | What does the network road show? | Lit loopback road, plus a dimmed Wi-Fi road labeled "unused by local files". Keeps the local-files rule. Measuring real Wi-Fi would mean serving the files from another machine. | T17, T20 |
| D3 | What format are shaders in, and which will the user supply? | **Answered 2026-11-05: the default.** Plain `#version 300 es` fragment shader with `u_time` and `u_resolution`. Shadertoy-style `mainImage` would need a wrapper that becomes part of what is compiled. **Update 2026-11-06:** the user supplied Day 560, a Shadertoy-style export with `mainImage` and `mainVolume`, so T23 uses a wrapper. T09 to T16 still assume one plain fragment shader and don't yet handle a two-pass shader. | T03, T09, T23 |

## 4. Tickets

Each ticket holds one idea. Files are listed in full so the scope is obvious.

---

### T01 Write CLAUDE.md
**Goal:** give every future session the project rules.
**Files:** `CLAUDE.md` (under 200 lines).
**Build:** cover the constraints in R1, the honesty rules in R6, and a pointer to this
backlog as the source of truth. Don't copy the schema or tickets into it.
**Teach:** why CLAUDE.md stays short: it loads into every session.
**Done when:**
- It is under 200 lines (`wc -l`).
- It states the measured, partial and modeled rule and the no-identifiers rule.

---

### T02 Scaffold the project
**Depends on:** T01.
**Goal:** two empty pages served with the right headers.
**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`,
`record.html`, `src/city/main.ts`, `src/record/main.ts`.
**Build:**
- Vanilla Vite + TypeScript + Three.js, no React. Pin versions.
- Set `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` with Vite's `server.headers`.
- Add a small Vite middleware that sets `Cache-Control: no-store` on `/shaders/`.
- Register both pages as build inputs.
**Teach:**
- Cross-origin isolation improves `performance.now()` from 100 µs to 5 µs (MDN).
- Why the recorder and the city are separate pages (the observer effect).
**Done when:**
- `npm run dev` serves both pages.
- `self.crossOriginIsolated` is `true` on both.
- `npx tsc --noEmit` passes.
- `.gitignore` covers `node_modules` and `dist`.

---

### T03 Add reference shaders
**Depends on:** T02. Uses decision D3.
**Goal:** known shaders to calibrate against. The user's own shaders go in the same folder.
**Files:** `shaders/trivial.glsl`, `shaders/cost-low.glsl`, `shaders/cost-mid.glsl`,
`shaders/cost-high.glsl`.
**Build:**
- `trivial`: a solid color. Later used as the baseline for link and first draw.
- The `cost-*` trio: the same fragment shader with a growing loop count, so cost changes
  on purpose. Use `u_time` so the compiler can't fold the loop away.
- The fixed vertex shader is a full-screen triangle and lives in TypeScript, not here.
**Teach:** why a ladder of known costs lets us test the timer before trusting it.
**Done when:**
- All four files compile as `#version 300 es`. A quick check in the record page is enough.
- Fetching one in the browser returns its raw text and a `no-store` header.

---

### T04 Probe the environment
**Depends on:** T02.
**Goal:** find out what Chrome really exposes on this Mac.
**Files:** `src/record/probeEnvironment.ts`, `probe.html`, `src/probe/main.ts`,
`docs/probe-results.md`.
**Build:**
- Read `EXT_disjoint_timer_query_webgl2` and `KHR_parallel_shader_compile`.
- Read `QUERY_COUNTER_BITS_EXT` for `TIME_ELAPSED_EXT` and `TIMESTAMP_EXT`.
- Read the renderer through `WEBGL_debug_renderer_info`, because plain `RENDERER`
  can be masked.
- Read the browser major version.
- Return only the fields in the schema's `environment`. No identifiers.
**Teach:**
- `chrome://gpu` lists GL extensions, which is not the same as what WebGL2 exposes.
- ANGLE's source suggests 64 elapsed bits and 0 timestamp bits (F2). This is the check.
**Done when:**
- The results are written to `docs/probe-results.md`.
- If the timer extension is missing, stop and tell the user: the T05 fallback applies.

---

### T05 Prove GPU timing works (GATE)
**Depends on:** T03, T04.
**Goal:** decide whether stop 6 can use the timer query at all.
**Files:** `src/probe/main.ts`, `docs/probe-results.md`.
**Build:**
- Draw at fixed sizes with a WebGL2 context using `antialias: false`.
- Collect `TIME_ELAPSED_EXT` results for 3 shader costs at 1280 x 800.
- Collect results for 1 shader at 2 pixel counts: 1280 x 800 and 640 x 400.
- Poll `QUERY_RESULT_AVAILABLE` on later frames. Never request a result early (F2).
- Separately, time draw plus a 1 x 1 `readPixels` as a wall-clock cross-check.
- Compare frame cadence with the query on and off.
**Teach:**
- The result is a time range across Metal command buffers, not busy time (F2).
- `gl.finish()` doesn't block in Chrome, so `readPixels` is the sync point (F3).
- `GPU_DISJOINT_EXT` is always 0 on Metal, so statistics replace that check (F4).
**Done when:**
- GPU time rises with shader cost and with pixel count.
- It roughly agrees with the `readPixels` cross-check.
- The results, including the on/off comparison, are in `docs/probe-results.md`.
- **If it fails:** stop 6 uses `readPixels` wall time, labeled partial. Tell the user and
  update R4 before continuing.

---

### T06 Test the shader caches
**Depends on:** T05.
**Goal:** learn how to get a repeatable cold or warm compile.
**Files:** `src/probe/main.ts`, `docs/probe-results.md`, then delete `probe.html` and
`src/probe/`.
**Build:**
- Compare compile, link and first-draw times for four cases: repeat in the same page,
  reload, a comment-only change, and a change to real code.
- Try one run with Chrome started using `--disable-gpu-shader-disk-cache`.
**Teach:**
- ANGLE's `LibraryCache` is keyed on translated MSL, so a comment-only change probably
  won't force a rebuild (inference, tested here).
- Why we never claim a truly cold driver compile: the macOS Metal cache is invisible (F9).
**Done when:**
- `docs/probe-results.md` states which change forces a slow path and what each cache state
  means for T16.
- Ask the user before deleting the probe files.

---

### T07 Schema, types and validator
**Depends on:** T02.
**Goal:** a recording can't be saved or drawn unless it is valid and honest.
**Files:** `schema/recording.schema.json`, `src/shared/types.ts`,
`src/shared/validateRecording.ts`, `tests/validateRecording.test.ts`,
`tests/fixtures/valid-recording.json`.
**Build:**
- Copy the schema from R7 exactly.
- Use `ajv/dist/2020` and `ajv-formats` with `strict: true`, `allowUnionTypes: true`.
- Add the checks the schema can't express:
  1. Stops 1 to 8 each appear exactly once.
  2. Every floor id points to a metric in that stop whose unit is `ms`.
  3. No string value contains UUID-shaped or UDID-shaped text.
- Patterns for rule 3:
  `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` and
  `[0-9a-f]{8}-[0-9a-f]{16}`, case-insensitive.
- Add Vitest as a dev dependency.
**Teach:**
- What `additionalProperties: false` blocks, and what the scan adds.
- Limit: a serial number has no fixed shape in free text, so the real protection is that the
  recorder never reads one.
**Done when:** tests pass for a valid fixture and these rejections: 1 stop, an injected
`serial` key, a bad status, an absolute shader path, a duplicate stop, a floor naming a
missing metric, a floor naming a non-ms metric, and a UUID inside a `note`.

---

### T08 Hardware map JSON
**Depends on:** T07.
**Goal:** the M2 as data, with a source on every number.
**Files:** `data/hardware-map.m2.json`, one test added to `tests/validateRecording.test.ts`.
**Build:**
- Use the numbers and bases in R3, and set `schematic: true`.
- Suggested block ids: `network-road`, `wifi`, `dev-server`, `memory-ring`, `cpu`, `p-cluster`,
  `e-cluster`, `gpu`, `gpu-core`, `slc`, `neural-engine`, `media-engine`, `display-engines`,
  `exit-built-in`, `exit-lg`.
- Don't trace or copy a die photo. Layout comes later from `layoutMap.ts`.
**Teach:** the difference between `published`, `community`, `this-machine` and `modeled`,
and why 8 MB of system-level cache is not `published`.
**Done when:**
- The file passes the schema's `hardwareMap` definition.
- Every number has a non-empty `source`.

---

### T09 Stop 1: fetch the shader
**Depends on:** T03, T07.
**Goal:** the first real metric, and the recorder page's skeleton.
**Files:** `src/record/fetchShader.ts`, `src/record/summarize.ts`, `src/record/main.ts`,
`tests/summarize.test.ts`.
**Build:**
- List files with `Object.keys(import.meta.glob('/shaders/*.glsl'))`. That lists paths without
  loading them. Confirm it works here.
- Use `fetch(url, { cache: 'no-store' })`, never Vite's `?raw`, which would bundle the file.
- Read the matching `PerformanceResourceTiming` entry: `responseEnd - startTime`.
- Compute `bytes` and `sha256` with `crypto.subtle`.
- Repeat the fetch and summarize into `n`, `min`, `median`, `p95`, `max`.
**Teach:** this measures loopback, not Wi-Fi (F5).
**Done when:**
- The page shows a loopback `fetchMs` with stats, plus `bytes` and `sha256`, for a chosen file.
- `summarize` is unit tested.
- Status is `measured`, and the source text says loopback.

---

### T10 Stops 2 and 3: call time and round trip
**Depends on:** T09.
**Goal:** what JS sees, and what crossing to the GPU process costs.
**Files:** `src/record/measureCallTime.ts`, `src/record/measureRoundTrip.ts`, `src/record/main.ts`.
**Build:**
- Stop 2: `performance.now()` around a batch of WebGL calls, for both the build calls
  (`buildCallsMs`) and the per-frame draw calls (`frameCallsMs`).
- Stop 3: time `gl.getError()`, which flushes and makes a round trip (`roundTripMs`).
- Both trips use these stops, so the data must keep them apart.
**Teach:**
- WebGL calls mostly queue work, which is why JS call time can be tiny.
- Why `getError` is only a proxy: it doesn't time the command buffer itself.
**Done when:** both stops produce metrics with stats. Stop 2 is `measured` and stop 3 is `partial`.

---

### T11 Stop 4: compile time
**Depends on:** T10.
**Goal:** GLSL validation and translation time, with clean failure handling.
**Files:** `src/record/measureCompile.ts`, `src/record/main.ts`.
**Build:**
- Time `compileShader` plus a blocking `getShaderParameter(COMPILE_STATUS)` (`compileMs`).
- On failure, show the shader's info log and stop the run. Save nothing.
**Teach:**
- What ANGLE does at compile: GLSL to MSL (F1).
- Why blocking on status is an observer effect the WebGL best practices warn about,
  and why it's accepted in a recorder.
**Done when:**
- `compileMs` has stats and status `partial`, with a note that it includes stops 2 and 3 overhead.
- A deliberately broken shader gives a readable error and no recording.

---

### T12 Stop 5: link and first draw
**Depends on:** T11.
**Goal:** both places the driver does work.
**Files:** `src/record/measureLink.ts`, `src/record/measureFirstDraw.ts`, `src/record/main.ts`.
**Build:**
- Floor 1: time `linkProgram` plus blocking `LINK_STATUS` (`linkMs`).
- Floor 2: time the first `drawArrays` plus `getError` (`firstDrawMs`).
- Time steady-state draws the same way (`steadyDrawMs`) as a baseline.
- Store the raw values. Never silently subtract the baseline.
- Set `floors` to `["linkMs", "firstDrawMs"]`.
**Teach:**
- Why compile plus link misses first-draw pipeline creation (F1).
- Pipeline creation is CPU-side, so the GPU timer won't catch it.
**Done when:**
- All three metrics exist with status `partial`.
- `trivial.glsl` run alongside gives the fixed vertex shader's contribution as a reference.

---

### T13 Stop 6: GPU time per frame
**Depends on:** T05, T12.
**Goal:** the production version of the T05 experiment.
**Files:** `src/record/measureGpuTime.ts`, `src/record/main.ts`.
**Build:**
- Canvas buffer fixed at 1280 x 800 (configurable), `antialias: false`.
- Run 60 warmup frames, then 300 sampled frames.
- Keep warmup in its own metric (`gpuMsWarmup`) so it stays visible but out of the median.
- Main metric: `gpuMs`.
- Poll for results on later frames, and handle queries still pending when sampling ends.
- Nothing else animates on the page, and the tab must stay visible.
**Teach:**
- This one number covers stops 6 and 7 together, so stop 7 gets no time of its own (F2).
- Why a fixed buffer makes results comparable across displays.
**Done when:**
- The results rise across `cost-low`, `cost-mid` and `cost-high`.
- The stop's status is `partial`. If the T05 fallback applies, use its method instead.

---

### T14 Stop 7: SIMD group model
**Depends on:** T13.
**Goal:** an honest model with no measurement behind it.
**Files:** `src/record/modelSimdGroups.ts`, `tests/modelSimdGroups.test.ts`.
**Build:**
- Pure function of the drawing buffer's size.
- `tileCount` at 32 x 32 tiles, and `simdGroups` = pixels / 32, rounded up. Both `modeled`.
- Note in the metric that `simdGroups` is a lower bound and the driver picks the tile size.
- `floors` stays empty, so stop 7 has no height.
**Teach:** what a 32-thread SIMD group is, and the worked example: 1280 x 800 = 1,024,000 pixels,
so 1,000 tiles and 32,000 groups.
**Done when:** the test covers the worked example, and both metrics are `modeled`.

---

### T15 Stop 8: refresh cadence
**Depends on:** T13.
**Goal:** the speed limit for the display holding the window.
**Files:** `src/record/measureRefresh.ts`, `src/record/main.ts`, `tests/measureRefresh.test.ts`.
**Build:**
- Collect at least 120 `requestAnimationFrame` deltas (`frameDeltaMs`).
- Derive `refreshHz` from the median delta, and classify it against 60 and 50 Hz.
- Record a mismatch rather than forcing a match.
- `floors` stays empty: compositor and scanout time can't be measured, so a time-based
  height would be invented.
- Keep the classification logic pure so it can be tested.
**Teach:**
- rAF timestamps may have only 1 ms precision, so one delta is noisy and a median helps.
- Cadence tells us the rate, not how long the compositor took.
**Done when:**
- It reads about 16.67 ms on the built-in display and about 20 ms on the LG.
- The stop's status is `partial`.

---

### T16 Run protocol and save
**Depends on:** T06, T08, T14, T15.
**Goal:** one button produces a valid, comparable recording.
**Files:** `src/record/saveRecording.ts`, `src/record/main.ts`, `record.html`, `recordings/.gitkeep`.
**Build:**
- Choose a shader and label the display (`built-in`, `lg`, `unknown`).
- Set `cacheState` based on T06. Use `unknown` unless T06 gives evidence.
- Default to 5 fresh programs for the build trip per recording, unless T06 suggests otherwise.
- Embed the hardware map, validate, then download
  `recordings/<shader>-<display>-<state>.json`. The user saves it by hand.
- Show a pre-run checklist: city tab closed, other GPU-heavy apps closed, plugged in.
**Teach:** how to read a recording, and why comparing runs matters more than one number.
**Done when:**
- A full run passes validation, with all 8 stops.
- Separate recordings exist for each display.
- Repeat runs are compared, and any large differences are reported to the user.

---

### T17 Ground blocks
**Depends on:** T08.
**Goal:** the map as a 3D city, with no timing data.
**Files:** `src/city/main.ts`, `src/city/layoutMap.ts`, `src/city/buildBlocks.ts`,
`tests/layoutMap.test.ts`.
**Build:**
- `layoutMap` is pure: block ids in, positions and sizes out. Follow the map in R2.
- Draw from `data/hardware-map.m2.json`, including the off-chip blocks and both display exits.
- Show a visible "schematic, not die-accurate" note.
- Don't import from `src/record`.
**Teach:** why pure layout is separated from Three.js: it can be tested without a GPU.
**Done when:**
- Every block in the JSON appears, and the layout test checks for no unintended overlaps.
- The city runs with no recording loaded.

---

### T18 Labels with sources
**Depends on:** T17.
**Goal:** every number can be traced to where it came from.
**Files:** `src/city/buildLabels.ts`, `src/city/main.ts`.
**Build:**
- Use Three's `CSS2DRenderer`, so text stays sharp and selectable.
- Each number shows its value, unit and basis. Its source appears on hover or click.
- The label builder requires a basis and source, so an unsourced number can't render.
**Teach:** what CSS2DRenderer does, compared with drawing text into textures.
**Done when:** every number in the hardware map shows a basis and source, and `modeled` is
visibly marked.

---

### T19 Stop buildings from a recording
**Depends on:** T07, T16, T18.
**Goal:** building height equals time, and the status is always visible.
**Files:** `src/city/loadRecording.ts`, `src/city/heightScale.ts`, `src/city/buildStops.ts`,
`src/city/main.ts`, `tests/heightScale.test.ts`.
**Build:**
- Load through a file picker. Validate before drawing, and show validation errors.
- Log scale: compute height from the **sum** of a stop's floors, then divide that height among
  floors in proportion to their ms. Stacking separately scaled floors would misstate the total.
- Styles: measured = solid; partial = solid with a hatched band; modeled = wireframe with a "modeled" tag.
- Different colors for one-shot (build trip) and per-frame values.
- Print exact ms on every building, because log heights are hard to compare by eye.
- Stops 2 and 3 are one building with two lanes. Stops 7 and 8 have no time-based height.
- Null value: a labeled placeholder, never a zero-height building.
**Teach:** why a log scale is needed, and how it can mislead without printed numbers.
**Done when:**
- `heightScale` tests pass, including the floor split.
- An invalid recording draws nothing and shows why.
- The heights match the recording's values.

---

### T20 Roads for both trips
**Depends on:** T19. Uses decision D2.
**Goal:** show the order of travel.
**Files:** `src/city/buildRoads.ts`, `src/city/main.ts`.
**Build:**
- Draw the build trip and frame loop from R5 as two visually distinct routes.
- Lit loopback road, dimmed Wi-Fi road (D2).
- A marker for the compiled pipeline waiting in memory between the trips.
- A visible note that road length means nothing.
**Teach:** why the path is two trips rather than one line from 1 to 8.
**Done when:** both routes visit the right stops in order, and the Wi-Fi road is visibly unused.

---

### T21 GPU district and stop 7 zoom
**Depends on:** T20. Uses decision D1.
**Goal:** connect GPU time to the core layout without inventing per-core data.
**Files:** `src/city/buildGpuDistrict.ts`, `src/city/main.ts`.
**Build:**
- 10 cores, all lit together, with fill = `min(gpuMs / frameBudgetMs, 1)`, tagged modeled.
- Print the exact unclamped percentage as well, so over-budget shaders stay visible.
- Example with a hypothetical 8 ms draw: 48% at 60 Hz, 40% at 50 Hz.
- Stop 7 opens a modeled wireframe view: one core as 4 x 32 lanes = 128 ALUs, with the
  note that 4 is per-cycle dispatch, not the number of groups a core can hold (F6).
**Teach:** why per-core lighting would be fiction here (F7).
**Done when:**
- The fill changes with the recording, and the modeled tag is always visible.
- Stop 7 shows no time of its own.

---

### T22 Replay and display comparison
**Depends on:** T21.
**Goal:** the finished v0: watch the trip and compare displays.
**Files:** `src/city/replay.ts`, `src/city/loadRecording.ts`, `src/city/main.ts`.
**Build:**
- Slowed-down playback of the two trips, using only recorded data, with a visible "slowed" label.
- Load two recordings of the same shader, one per display, and swap between them.
- Both exits always show their speed limit: 60 Hz at 16.67 ms and 50 Hz at 20.00 ms. The
  recording's display is highlighted, with its measured cadence beside it.
- Warn when compared recordings differ in shader hash, buffer size or cache state.
**Teach:** with the same buffer, GPU time should stay similar while the frame budget changes.
That's what the comparison shows.
**Done when:**
- Replay works with no measuring code imported by the city.
- Swapping recordings updates the speed limit highlight and GPU fill.
- `imports[]` values, if present, are shown beside browser values and never replace them.

---

### T23 Live view of the user's shader (Day 560)
**Depends on:** T05.
**Goal:** see the user's own shader running on the GPU, with what a page can really measure, before
the recorder exists. This is a third page. It doesn't save a recording or feed the city.
**Files:** `shader.html`, `shaders/day560-common.glsl`, `shaders/day560-volume.glsl`,
`shaders/day560-image.glsl`, `src/shaderView/*`, `tests/shaderViewWorkload.test.ts`,
`vite.config.ts`.
**Build:**
- Pass code taken unchanged from the user's export, with a wrapper for `mainImage` and `mainVolume`.
- A 128-cube feedback volume, drawn one layer at a time, then the Image pass at 1280 x 800.
- GPU time per pass against the 60 Hz and 50 Hz budgets, and the last 300 frames.
- A cost map: scissored regions timed for this shader and for a uniform-cost control.
**Teach:** why a time range isn't busy time, and why a control is needed before reading a pattern.
**Done when:**
- The shader runs in the user's Chrome on the M2 with no console errors.
- Every number shows a status and a source.
- The cost map reports its own checks, and the page says plainly when they fail.

### T24 Live view inside the city
**Depends on:** T22, T23.
**Goal:** the user's words on 2026-11-06: "i at least wanna be able to see some wireshark going on" and "some
program something going through this diagram in a way that is interacting with the hardware". Opening `/`
shows it with no clicks and no second page.
**Files:** `server/*`, `program.html`, `src/program/*`, `src/city/live/*`, `src/shared/liveEvents.ts`,
`tests/parseNative.test.ts`, `tests/liveMode.test.ts`, plus wiring in `src/city/main.ts`, `hud.ts`, `stage.ts`,
`numbersPanel.ts`, `buildBlocks.ts`, `buildGpuDistrict.ts`, `palette.ts`, `city.css`, `index.html`, `vite.config.ts`,
`tsconfig.json`, and `dayRenderer.ts` (the control program is now optional). New dev dependency: `@types/node`.
**Build:**
- A Vite plugin streams `/__live/events`: each HTTP request the server handles, plus a sample every 500 ms
  from `os.cpus()`, `ioreg`, `netstat -ib` and `nettop`. None need root. Parsers keep named numbers only.
- `program.html` runs Day 560 in an iframe on the city page and posts each fetch, compile, link, first draw and
  frame to the page. The city draws those events and measures nothing itself.
- One dot per real event. A dot waits at a stop for that event's own ms, slowed x3 (build) or x40 (frame).
- A capture table with filters, where every row has a status and a source.
**Teach:** a browser tab can't read hardware counters but the Node dev server can, so it streams them over SSE.
These readings are the whole Mac, so they are partial, and one number covers all 10 GPU cores.
**Done when:**
- `/` animates with real data on load, with no clicks: yes, no console errors.
- Stopping the program visibly drops the GPU reading: yes, 83% to 8%, and 74% after Restart.
- No device identifier reaches the page: the parsers drop netstat's address column, with a test for it.
- Replay and the invented preview still work: yes, in the browser.

### T25 Day 442 as the live program
**Depends on:** T24.
**Goal:** the user's words on 2026-11-11: "lets start with this simpler shader". The city's live program becomes
Day 442, a one-pass shader, so the trip is one fetch, one compile and one draw call per frame.
**Files:** `shaders/day442-common.glsl`, `shaders/day442-image.glsl`, `src/shared/liveProgram.ts`,
`src/program/imageRenderer.ts`, `src/program/buildPasses.ts`, `src/program/main.ts`, `src/shared/liveEvents.ts`,
`src/city/live/liveRecorder.ts`, `wireRows.ts`, `liveMode.ts`, `src/city/main.ts`, `index.html`, `program.html`,
`tests/liveMode.test.ts`.
**Build:**
- Pass code unchanged from the user's export. Common is pasted in front of Image, with our wrapper around both.
- One program, one timer query per frame. The frame event carries one `gpuMs`.
- The shader's name and files live in `src/shared/liveProgram.ts`, so the page text can't disagree with the program.
**Teach:** simpler to follow isn't cheaper to run. Common isn't a second program. One pass means one draw call.
**Done when:**
- Day 442 runs in the city in the user's Chrome with no console errors: yes.
- Every stop still shows a value with a status and a source: yes.
- Tests and type-check pass: yes, 92 tests.

### T26 Show where the shader executes, in levels
**Depends on:** T25.
**Goal:** the user's words on 2026-11-11: "understand how the code executes and how it travels through the hardware
of my computer", "very clear", "keep using the toggles so we see more information on the left", and "levels so we
show for example the simd and then we can click and go deeper there".
**Files:** to be listed when the ticket starts. Expect `src/city/levels.ts` (new), `buildGpuDistrict.ts`,
`buildRoads.ts`, `routePlan.ts`, `live/trafficPlan.ts`, `numbersPanel.ts`, `hud.ts`, `main.ts`, `index.html`, `city.css`.
**Build:**
- **Three roles, visibly different.** Translate (stops 1, 4, 5: text to Metal code to machine code, once), Command
  (stops 2, 3: the draw call, a thin road), Execute (stops 6, 7: the only place the GLSL runs, the visual centre).
  Each stop's panel section says what form the shader is in there.
- **Levels with a breadcrumb.** Clicking goes one level deeper, and the left panel shows that level's numbers.
  1. Chip: the whole trip.
  2. GPU district: one draw fans out into pixel jobs across the cores for the measured GPU time, then one image leaves.
  3. One core: the SIMD lanes, 32 pixels per group. Replaces the "Open stop 7 view" button.
  4. One SIMD group: one line of Day 442 (for example `p = abs(p) - 0.45`) applied to 32 pixels at once.
- **Stop 7 nested in stop 6:** no road between them, because it is a zoom and not a later step.
- **A linear "one frame" bar:** JS call, hand-off and GPU time to true scale, from the measured numbers.
- Levels 2 to 4 are modeled and tagged so. A page can't see inside the GPU.
**Teach:** command versus execute. Why one draw call becomes a million pixel jobs. Why 32 pixels share one instruction,
and what that means for `if` and `break` in the ray march.
**Done when:**
- Each level can be reached by clicking and left by the breadcrumb, and the panel follows.
- The fan-out lasts the frame's measured GPU time, slowed by the printed factor, and is tagged modeled.
- The frame bar's three parts match the panel's numbers.
- Stop 7 has no road and no time of its own.

### T27 The whole path, from disk to pixels, with the CPU cores drawn
**Depends on:** T25.
**Goal:** the user's words on 2026-11-11: "follow the pipeline of the execution of the shader from the bin files of
the computer to the hardware level" and "i don't see the cores should we see them?".
**Files:** new: `server/processSampler.ts`, `server/shaderFiles.ts`, `src/city/processZones.ts`,
`src/city/shaderForms.ts`, `src/city/live/coreTiles.ts`, `live/processView.ts`, `live/compileEffect.ts`. Changed:
`data/hardware-map.m2.json`, `server/hardwareSampler.ts`, `liveFeedPlugin.ts`, `parseNative.ts`,
`src/shared/liveEvents.ts`, `src/city/layoutMap.ts`, `routePlan.ts`, `buildRoads.ts`, `buildBlocks.ts`, `buildStops.ts`,
`mapClaims.ts`, `palette.ts`, `main.ts`, `city.css`, `live/hardwareView.ts`, `liveMode.ts`, `trafficPlan.ts`,
`wireRows.ts`, and tests `parseNative`, `layoutMap`, `routePlan`, `liveMode`.
**Build:**
- **An SSD block, off-chip, where the trip starts.** The dev server reports the time it took to read each `.glsl`
  file (measured in Node). The road runs SSD, dev server, loopback, stop 1.
- **Eight CPU core tiles,** 4 P and 4 E, each named, each with its own live load. Today these are unlabeled bars.
- **Three processes named on the CPU district:** Node (dev server), Chrome renderer, Chrome GPU process. Each shows
  its CPU use from `ps`, with no root. Stops 2 to 5 are grouped under the process that runs them.
- **No dot ever lands on a core.** macOS doesn't tell a page, or `ps`, which core ran a thread. The panel says so.
- **Each stop names the form the shader is in:** text file, JS string, GLSL in the GPU process, Metal source,
  machine code for the GPU, then pixels. The last two forms are modeled.
**Teach:** a process isn't a core: macOS moves threads between cores many times a second. Why Chrome uses a
separate GPU process. Why per-process CPU is a real reading and per-core placement would be invented.
**Check before building:** `ps -axo %cpu,command` worked without root on 2026-11-11 and showed one `gpu-process`
and 13 `renderer` rows. Which renderer is our tab isn't known yet. The parser must keep only the type and the
number, because the command line holds paths.
**Done when:**
- The trip can be followed from the SSD block to a display exit with no gap: yes. A test walks every step of
  the dot's trip and checks each one starts where the last ended.
- All 8 cores are visible with names and live load, tagged partial and whole Mac: partly. All 8 show a name and a
  percent on the map (P1 to P4, E1 to E4). The partial tag and the "whole Mac" source are on each core's panel row,
  not on the 8 map labels, to keep them readable. At the default camera, towers 4 and 5 stand in front of E1 and E4.
- Compiling the shader visibly raises the GPU process's CPU reading, or the page says it didn't: the page says
  which. On 2026-11-11, 3 restarts gave one rise (20% to 29%) and two "did not visibly raise" (23% to 25%, 21% to
  21%). On first load it says it has no sample from before the build.
- No path or identifier from `ps` reaches the page, with a test for it: yes. Checked on the live feed too.
- 108 tests and the type-check pass. No console errors in Chrome.

**Findings, 2026-11-11:**
- `ps %cpu` on macOS is a decaying average, so the sampler uses the change in each process's CPU time instead.
  100% means one core busy for the whole sample.
- VS Code has its own `--type=renderer` and `--type=gpu-process` rows. The parser only counts Chrome's.
- `ps` can't say which renderer is our tab, so the city shows all Chrome renderers added up, plus the busiest.
- The dev server now serves `/shaders/*.glsl` itself, so the read it times is the one that answered the request.
  Reads took 0.3 to 0.6 ms. macOS may answer from its file cache in memory, so the reading is partial and doesn't
  prove the SSD was touched.
- The build takes about 75 ms and a sample is about 560 ms, so a compile is at most about 13% of one sample. That
  is why the rise is usually inside the noise. The 5-point threshold is ours.
- Node's reading comes from `process.cpuUsage()`, not `ps`, because it is exact for the dev server's own process.
- Shader forms at stops 3 and 4 are tagged published (Chromium and ANGLE docs), not measured. T28 can make stop 4
  measured.

### T28 What the compiler turned the shader into
**Depends on:** T25.
**Goal:** the user's words on 2026-11-11: "should we show how the compiler is running the code".
**Files:** to be listed when the ticket starts. Expect `src/program/buildPasses.ts`, `src/shared/liveEvents.ts`, a new
panel file under `src/city/live/`, `city.css`.
**Build:**
- Ask Chrome for the translated source with `WEBGL_debug_shaders`. On this Mac that should be Metal Shading
  Language. Show it beside the GLSL at stop 4, with both sizes.
- Mark the user's functions in both texts (`map`, `shape`, `rayMarch`), so one can be followed across.
- Everything after that text (Metal's intermediate code, GPU machine code) is modeled. A page can't read it.
**Teach:** two compilers, not one. ANGLE rewrites GLSL as Metal source, then Apple's compiler builds machine code.
Loops and `#define AA 2` look different after each step.
**Check before building:** that `WEBGL_debug_shaders` is exposed in the user's Chrome and returns Metal source, not
GLSL. If it isn't, this ticket shrinks to a modeled diagram, and says so.
**Done when:**
- The translated text shown is the one Chrome returned for this exact shader, tagged measured, with its source.
- The stages after it are drawn as modeled.

**Files used:** `src/shared/translatedText.ts` (new, pure), `src/shared/translatedSource.ts` (moved from
`src/experiments/`), `src/shared/liveEvents.ts`, `src/program/buildPasses.ts`, `src/city/shaderForms.ts`,
`src/city/buildStops.ts`, `src/city/main.ts`, `src/city/live/compilerPanel.ts` (new), `src/city/live/liveMode.ts`,
`src/city/live/wireRows.ts`, `city.css`, `tests/compilerText.test.ts` (new). The experiments page imports the moved file.

**Result, 2026-11-11, in the user's Chrome on the M2, live mode:**
- Check before building: `WEBGL_debug_shaders` is exposed and returns Metal Shading Language (`#include <metal_stdlib>`).
- The program frame reads the text after the link is timed and posts a `translated` event. The city only shows it.
- Stop 4's row reads "GLSL in, Metal source out", tagged measured, source `WEBGL_debug_shaders.getTranslatedShaderSource`
  for this exact fragment shader: yes. With a file or the preview on screen it falls back to published: yes.
- "Open compiler view" on stop 4 shows GLSL (6,047 bytes, 257 lines) beside Metal (24,779 bytes, 663 lines), both
  tagged measured with their source. Clicking a function highlights it in both texts: yes.
- Steps 3 (Apple's Metal compiler) and 4 (GPU machine code) are dashed outlines tagged modeled: yes.
- `npm test`: 129 pass, 1 fails. The failure is older than T28 (parking lot). `tsc --noEmit` is clean.

**Findings from T28:**

- Two compilers. ANGLE's output is the last text a page can read. Its size is about 4x the GLSL.
- 377 of the 663 Metal lines name ANGLE. 232 of them name none of the user's functions or variables: pure plumbing
  for uniforms, inputs and outputs, which Metal has no globals for.
- ANGLE prefixes every user name with `_u` (`map` becomes `_umap`). 10 of the 12 GLSL functions are found that way.
- `sdLink` and `arrow` are defined but never called (`sdLink` only appears in a comment), and ANGLE left both out.
- All 4 GLSL `for` loops are `while` loops in the Metal text, and 0 `for` loops remain.
- No `#define` name survives: `AA` is written 6 times in the GLSL and 0 times in Metal, and the same is true of `FAR`
  and `PI`. The preprocessor swaps in the value before ANGLE translates.
- `shaders/day442-image.glsl` now says `#define AA 1`, not 2 as this ticket says. It changed in dc8573a.
- The GLSL is 6,047 bytes in UTF-8. The 5,595 noted in the check was a character count: the banner comment has
  multi-byte characters.
- Whether Apple's compiler unrolls the loops, or hoists `r2(iTime * 0.05)` out of the fold loop, can't be seen from a page.

### T29 Which code costs GPU time
**Depends on:** T25. Uses the timing method from T05.
**Goal:** the user's words on 2026-11-11: "understand and see how some code in their program is making the gpu run
slower" and "the goal is maybe to make the shader simpler".
**Files:** `experiments.html`, `src/experiments/` (`variants`, `schedule`, `summarize`, `variantProgram`, `runTimings`,
`pictures`, `buildResult`, `resultView`, `sourceView`, `main`, `experiments.css`), `src/shared/experimentResult.ts`,
`server/experimentStore.ts`, `vite.config.ts`, `tests/experiments.test.ts`. Output: `data/experiments/day442.json`.
The city doesn't read the saved result yet (parking lot).
**Build:**
- A page can't time one line of a shader. It can compile a copy with one thing changed and time the whole frame
  again. The difference is that thing's cost.
- Variants of Day 442, each a one-line change made by the tool, never saved over the user's file: `AA 1`, 30 march
  steps, 3 folds, no normal, and the fold's `r2(iTime * 0.05)` passed in as a ready-made matrix.
- Variants run interleaved and repeated, with the spread shown, because T05 found 38% run-to-run noise.
- Result: a bar per variant, "this change saves about X ms of 39 ms", tagged partial. Beside it, a picture of each
  variant, because a cheaper shader that looks wrong isn't a saving.
- Clicking a bar highlights the lines it changed.
**Teach:** why per-line GPU profiling doesn't exist for a page. Why the costs don't add up (T05: time isn't
proportional to work). Why 32 pixels in a SIMD group all wait for the slowest ray.
**Done when:**
- Every variant compiles, and its changed lines are shown.
- Each bar has a median, a spread and the number of runs.
- A no-change variant reads the same as the original within the spread, or the page says the method failed.

**Result, 2026-11-11, in the user's Chrome on the M2, 2 runs:**
- Every variant compiled, and clicking a row shows its changed lines: yes. Each bar shows a median, a range across
  rounds and the number of rounds and frames: yes. The control passed in both runs, but see the first finding.
- 119 tests and the type-check pass. No console errors on a reload.

**Findings from T29 (median saving, then its range over 6 rounds; all partial; "agreed" = every round had the same sign):**

| Variant | Run 1 (original 41.7 ms) | Run 2 (original 33.4 ms) | Picture (measured, same in both) |
|---|---|---|---|
| No change (control) | -1.0, -14.1 to 15.1 | -1.8, -9.1 to 12.8 | identical |
| `AA 1` | **18.9, 12.2 to 28.5, agreed** | **21.9, 9.5 to 30.2, agreed** | 2.7 levels, 10.9% of pixels moved |
| 30 march steps | 14.5, 5.7 to 19.7, agreed | 10.1, -1.5 to 19.9 | 25.1 levels, 35% moved |
| 3 folds | 10.5, -1.6 to 18.3 | -2.9, -9.3 to 19.4 | 29.5 levels, 58% moved |
| No normal | 7.9, -0.1 to 20.5 | 3.9, 2.0 to 15.7, agreed | 22.2 levels, 45% moved |
| Fold matrix from JS | 2.0, -6.2 to 15.9 | 2.2, -6.1 to 15.8 | identical |

- **The noise is as wide as most savings.** The control, which is the same text compiled again, swung by 9 to 15 ms
  in a single round. So the method can't separate a 5 ms effect with 6 rounds. It passed its own check (the
  control spans zero), but a pass at this width says little.
- **`AA` is the only change that was clearly cheaper in both runs:** about 19 to 22 ms of 33 to 42 ms, and the
  picture barely changed (mean 2.7 of 255 levels). One ray per pixel instead of four didn't cut the time to a
  quarter. It cut it roughly in half. That fits T05: time isn't proportional to work.
- **30 march steps and 3 folds change the picture a lot** (35% and 58% of pixels moved), so neither is a free saving
  even where it read cheaper.
- **The fold matrix from JS made no clear difference,** with an identical picture. The compiler may already compute
  `r2(iTime * 0.05)` once rather than per step, but that is inferred: the Metal code (T28) would show it.
- **The run is much slower than its frames suggest.** Run 2 took 293 s for 1,092 frames (268 ms each on average),
  but the median gap between frames was 17.1 ms. So a few very long stalls took most of the time. Run 1 took about
  140 s. The cause isn't known. A GPU left idle between stalls may also drop its clock, which would add noise. Not
  checked: whether a city tab was open in another window.
- A few single-round readings were far below the rest (`AA 1` had a round at 4.65 ms). Cause unknown.

### T30 Spare room, and whether the shader can reach it
**Depends on:** T27, T29.
**Goal:** the user's words on 2026-11-11: "see how some hardware in the computer are not utilize so we can use them in
our program" and "find some space in the hardware we're not utilizing to make the code faster".
**Files:** to be listed when the ticket starts. Expect `src/city/live/hardwareView.ts`, `data/hardware-map.m2.json`, a new
panel file, `city.css`.
**Build:**
- Each hardware block gets two labels: how busy it is (partial, or "no reading" for the Neural Engine and media
  engine), and whether a WebGL fragment shader can use it (yes, indirectly, or no, with the reason).
- Idle blocks are drawn dim with an "idle" tag, so spare room is visible at a glance.
- An "indirectly" list for the CPU: work that is the same for every pixel can be done once in JS and passed in as
  a uniform. T29 measures whether that helps.
**Teach:** a fragment shader only runs on the GPU. Idle CPU cores can't take pixels from it. What they can take is
work that doesn't depend on the pixel. With the GPU at 100%, the shader has no spare room where it runs.
**Done when:**
- Every block shows a load or "no reading", and a reachable label with its reason.
- The page states plainly which part is the bottleneck for the running shader, from the measured readings.

**Files used:** `src/city/live/spareRoom.ts` (new, pure), `src/city/live/spareRoomView.ts` (new),
`src/city/live/hardwareView.ts`, `src/city/live/liveMode.ts`, `city.css`, `tests/spareRoom.test.ts` (new). The hardware
map JSON and `buildBlocks.ts` were not changed: the reach reasons live in `spareRoom.ts` with their sources, and the
idle cover sits on top of the blocks like the core tiles do.

**Result, 2026-11-11, in the user's Chrome on the M2, live mode, built-in display:**
- Every block shows a load or "no reading", and a reach label with its reason and source: yes. 10 blocks, in a card
  on the map and in the "Spare room" panel section. GPU cores, both clusters and Wi-Fi have a load (partial). SLC,
  unified memory, Neural Engine, media engine, display engines and SSD show "no reading".
- The page states the bottleneck from the readings: yes. Running, it said "The GPU is the bottleneck: busy 100%,
  while the busiest CPU core is at 65%. Each frame's draw takes 13.10 ms of GPU time against a 16.67 ms budget. It
  still meets the budget...", tagged modeled. Stopped, it says there is no shader to judge.
- Idle cover: checked by tests only. No block went under the idle line live: the E cluster read 53 to 66% and Wi-Fi
  1 to 2 KB/s, so the cover was never drawn on screen.
- `npm test`: 140 pass, 1 fails (the old `AA 2` test in the parking lot). `tsc --noEmit` is clean. No console errors.

**Findings from T30:**
- **The GPU reads 96 to 100% with Day 442 stopped.** So most of the live GPU reading is the city drawing itself (and
  any other app), not the shader. The verdict can say the GPU is full, but not how much of it is Day 442's. This
  also applies to T24 and T25's 100% readings. Only a run with the city tab closed (T16's recorder) can separate them.
- **The CPU is busy without the shader too:** the E cluster stayed at about 63% and the busiest core at 68 to 72%
  with the program stopped. The city, Chrome and other apps are the load there.
- **Day 442 at `AA 1` met the 60 Hz budget:** stop 6 read 13.10 and 14.31 ms (partial) against 16.67 ms. T25 read
  39 ms at `AA 2`. So it is no longer late, but the GPU has no room left to add work.
- **No block a fragment shader can use is idle.** The only "yes" is the GPU cores, and they are full. The CPU is
  "indirectly", and T29 found no clear saving from the one thing it could take (the fold matrix).
- The idle (under 10%) and full (90% or more) lines are ours, and the page says so.

### T31 Root readings from `powermetrics`
**Depends on:** T24. Feeds T27 and T30.
**Goal:** the user's words on 2026-11-11: "what do we need so u can have root access?". The user added a sudo rule
that allows one exact command with no password, and it worked.
**Files:** to be listed when the ticket starts. Expect `server/hardwareSampler.ts`, `server/parseNative.ts`,
`src/shared/liveEvents.ts`, `src/city/live/hardwareView.ts`, `tests/parseNative.test.ts`.
**Build:**
- The dev server runs `sudo -n /usr/bin/powermetrics --samplers cpu_power,gpu_power -i 500 -n 1`. The arguments
  must match the rule exactly, or sudo asks for a password and the call fails.
- If the call fails, the feed carries "no root reading" and everything else keeps working.
- The parser keeps named numbers only. The header lines (machine model, OS build, boot arguments) are dropped,
  with a test.
- New readings, all partial and whole Mac: frequency and active share for each of the 8 CPU cores and both
  clusters, GPU frequency and active share, and CPU, GPU and Neural Engine power in mW.
**Teach:** a chip changes its clock speed with load, so "busy 30% of the time" at 600 MHz is far less work than at
3,504 MHz. Power is the reading that shows which block is doing the work.
**Done when:**
- Each new number shows on its block and in the panel with a status and a source.
- Removing the sudo rule leaves the city working, with "no root reading" shown.
- No header line from `powermetrics` reaches the page, with a test for it.

**First sample, 2026-11-11, city and Day 442 running (one 503 ms sample, partial):**
- GPU: 1,398 MHz, its top step, for 100% of the sample. Idle 0%. Power about 9.3 W.
- CPU: 1.6 W in total. No core was active for more than 31% of the sample. Neural Engine: 0 mW.
- So the GPU drew about 6x the power of all 8 CPU cores together. It has no spare room and no faster clock step.
- The 1,398 MHz top step matches the community number in R3.
- `powermetrics` reports E cores as CPU 0 to 3 and P cores as CPU 4 to 7, which agrees with T24's check.
- Decision for the user: CLAUDE.md still says native tools are out of scope for v0. This goes further than T24.

### T32 How each line of Day 442 compiles and runs, with no suggestions
**Depends on:** T29 (replaces its page), T28 (absorbs its translated-source check).
**Goal:** the user's words on 2026-11-11: "we don't want ur guess", "point out how the code is interacting with the
hardware, the compiler, what line of code is making it slower", "u shouldn't add suggestions... that's for the user
to decide after it sees the visualization".
**Rule for this page:** it never proposes a change. No variants picked by the tool, no "this saves X", no advice.
It shows what the code did on the hardware, and the user decides what to change.
**Files:** `experiments.html`, `src/experiments/` (rewritten), `src/shared/experimentResult.ts`,
`server/experimentStore.ts`, `tests/experiments.test.ts`. T29's `variants.ts`, `summarize.ts`, `buildResult.ts`,
`pictures.ts` and `resultView.ts` go away.
**Build, three panels around the user's own source:**
- **Compiler (measured text).** `WEBGL_debug_shaders.getTranslatedShaderSource` returns what ANGLE handed to Apple's
  Metal compiler. Show it beside the GLSL, with sizes, and link each user function (`shape`, `map`, `rayMarch`, ...)
  across the two texts. Everything after it (Metal IR, GPU machine code) is drawn as modeled: a page can't read it.
- **Work per line (measured count).** The tool numbers every `{ }` block in the source and compiles a counting copy
  that adds `_c++` at the top of one block and writes the count instead of a color. `readPixels` reads it back. So
  every line gets: how many times it ran this frame across all 1,024,000 pixels, its maximum in one pixel, and a
  heatmap of where on screen it ran. Control flow is unchanged by the counter, so the counts are exact. The counting
  copy is never timed.
- **Time by screen area (partial).** The real shader drawn under a scissor, one tile at a time, each tile around a
  `TIME_ELAPSED_EXT` query, repeated with spread. Shown as a heatmap beside the count heatmaps, so the user can see
  whether the slow areas are where a line ran most. A time range per tile, including the draw's fixed overhead.
- **SIMD groups (modeled, from measured counts).** Apple's GPU runs 32 pixels in lockstep (published). Their shape on
  screen isn't published, so the 8 x 4 grouping is modeled. Per loop: the group runs as long as its slowest pixel,
  so show max vs mean iterations per group and the share of lanes waiting.
**Teach:** no browser API times a line, so time per line is never shown. What a page can measure is how often each
line ran, and where the time went on screen. Two compilers sit between the GLSL and the GPU. A SIMD group finishes
when its slowest pixel does.
**Check before building:** that `WEBGL_debug_shaders` is exposed in the user's Chrome and returns Metal source.
**Done when:**
- The page contains no suggestion or variant chosen by the tool.
- Every line of the Image and Common pass shows a count and a max, tagged measured, with its source.
- A self-check: the counted iterations of the 60-step loop never exceed 60 per ray, and the `mainImage` block runs
  exactly once per pixel (1,024,000).
- Tile times show a median, a range and the rounds, tagged partial.
- The translated source shown is the text Chrome returned, or the page says the extension is missing.

### T33 Chip-like look for the city
**Depends on:** T17.
**Goal:** the map reads as a chip package on a logic board, with no change to layout, roads, stops or numbers.
**Files:** `src/city/palette.ts`, `src/city/dieTexture.ts`, `src/city/buildBoard.ts`, `src/city/buildBlocks.ts`,
`src/city/buildGpuDistrict.ts`, `src/city/main.ts`, `src/city/city.css`, `index.html`.
**Build:**
- Die blocks take muted tints after Apple's M2 artwork (blue-violet, pink, gold). The memory ring is drawn as a gold
  package frame. Off-chip blocks look like chip packages and a shielded can.
- `buildBoard` adds a board, a substrate and small parts as one `InstancedMesh`. They are untagged, so clicks pass through.
- `dieTexture` is one 64 px canvas, repeated, for the cell pattern.
- No new lights, no environment map, no post-processing. The arrangement is not taken from a die photo.
**Teach:** metalness without an environment map renders dark; an `InstancedMesh` is one draw call; a repeated
texture is cheaper than geometry.
**Done when:**
- Layout and route tests still pass, and the legend says the colors and board parts are illustrative.
- One-shot orange and per-frame cyan are still the brightest colors on the map.

**Findings from T33:**
- The board adds 2 slabs and 1 instanced draw call. The die pattern adds 7 small textures that share one canvas.
- Block names needed a dark backing in CSS, because the blocks under them are no longer dark.
- The dimmed exit roads (opacity 0.28) are faint over the gold display engines block.
- `tests/experiments.test.ts` has 1 failing test (`maxPerParent` expected 4, got 1). T33 doesn't touch that code.

---

## 5. Parking lot

- **From T27: Metal's compiler helper process.** Apple's Metal can compile in a helper process
  (`MTLCompilerService`). None was in `ps` when checked on 2026-11-11, and this wasn't verified further. If it runs
  during a build, stop 5's CPU work is partly outside the Chrome GPU process and the city doesn't read it.
- **From T27: put the partial tag on the core map labels,** or one tag per cluster, if the user wants it on the map.
- **From T27: R2's map and R5's roads don't show the SSD block yet.**
- **From T29: the city doesn't read `data/experiments/day442.json` yet.** A stop 6 panel section could list the bars.
- **From T29: find the long stalls during an experiment run** (median frame 17 ms, mean 268 ms). Then try more rounds,
  or wait for each timer result before the next draw so the GPU never queues, and see whether the control narrows.
- **From T29: the variant list is fixed in code.** Picking a line to change from the page would need a small editor.

New ideas or out-of-scope findings go here, not into the current ticket.

- From T28: `tests/experiments.test.ts` line 43 expects `AA 2` (maxPerParent 4), but Day 442 is `AA 1` since dc8573a,
  so it fails. Decide which is right, the shader or the test.
- From T28: store a SHA-256 of the translated text in the recording, so a cache run (T06) can tell if the Metal text
  changed between builds.
- From T28: the city's compiler view and the experiments page's compiler panel are two views of one text. T32 can
  merge them.
- From T30: measure how much GPU the city itself uses. Stop the program, then read the GPU with the city tab open,
  hidden and closed. That tells how much of every live GPU reading is the city's own drawing.
- From T30: the city could stop drawing (or draw at a lower rate) while Day 442 runs, so the live readings are
  closer to the shader's own. That changes how the live view looks, so it is the user's call.
- From T30: 10 more cards on the map. If it feels crowded, hide them unless the "Spare room" section is open.

- After v0: import native summaries from Instruments or tshark through `imports[]`.
  Summaries only, never raw traces, which can contain identifiers.
- From the two questions (2026-11-11): compile the translated Metal source with `xcrun metal` to see the
  intermediate code. Needs Xcode, and it wouldn't be the exact binary Chrome's GPU process built.
- From the two questions: move pixel work off the GPU with WebGPU compute or a worker. Not a WebGL fragment
  shader any more, so it is a different program, not a faster Day 442.

**Findings from T02:**

- Pinned versions: Vite 8.3.6, TypeScript 7.0.2, Three.js 0.187.0, `@types/three` 0.187.0.
- Vite 8 uses Rolldown, so build inputs go under `build.rolldownOptions`, not `rollupOptions`.
- `tsconfig.json` needs `moduleDetection: "force"`. Without it, a `main.ts` with no import or
  export is treated as a global script, and the two pages' top-level names clash.
- `.glsl` files are served with an empty `Content-Type`. `fetch().text()` still returned the raw
  body in a `curl` check. T03 should confirm this in the browser.
- The `no-store` middleware is on the dev server only, so run the recorder under `npm run dev`.

**Findings from T07, T08 and the city (T17 to T22):**

- Pinned versions: `ajv` 8.20.0, `ajv-formats` 3.0.1, Vitest 5.1.0. `npm test` runs Vitest.
- `src/city/placeholderRecording.ts` holds invented numbers for previewing the city. Open it with
  the "Preview with invented numbers" button or `/?preview`. Each status is the one R4 plans for
  that stop, so the preview shows the final drawing style. Every source says INVENTED, each card
  has an "invented" tag, and a fixed banner shows while it is on screen. The all-zero `sha256`
  marks it. Delete it, or keep it as a demo, once real recordings exist.
- `roundTripMs` is one metric but both trips cross it. The shared 2 + 3 building has one lane per
  trip and draws this metric on both, with a note. T10 says the data must keep the trips apart, so
  decide there whether to split it into two metrics. If so, update `floorBelongsToTrip`.
- Trip membership for shared floors comes from metric id prefixes in `planBuildings.ts`, and T10
  must keep the `build` and `frame` prefixes. Applying that check beyond stops 2 and 3 dropped
  stop 6 from replay, so it now applies only to those two stops.
- Layout differs from the R2 drawing in two ways. GPU cores sit in front of stops 6 and 7, because
  the towers hid them otherwise. The map is wider than R2 suggests, to fit a wide window and give
  the labels room. It is still schematic.
- `dcp` and `dcpext` were added as map blocks, beyond the suggested ids, because R2 draws them.
- D1 and D2 are built with their defaults. Both are still open for the user to answer.
- Replay scales each trip separately, so the build trip and the frame loop have different "slowed"
  factors, both shown on screen. Road time is a fixed, unmeasured 0.45 s per leg.
- Hardware numbers hide automatically while a recording is showing, except on the two exits. A
  toolbar button brings them back. Non-floor metrics such as `steadyDrawMs` appear on card hover.
- Not checked: final layout in the user's real Chrome (the extension disconnected partway, so the
  final checks used headless Chrome with a software GPU), orbit by mouse, and hover-to-reveal with
  a real pointer. One early real-Chrome screenshot showed a rotated camera. It did not recur, the
  cause is unknown, and no code rotates the camera.
- `npm run build` warns about a chunk over 500 kB (Three.js). Harmless for a local tool.

**Findings from the clean map change (user request, 2026-11-05, not a ticket):**

- The map now shows names only. All numbers, tags, sources and notes moved to a left panel
  (`src/city/numbersPanel.ts`). Clicking a building, block or name selects it, then opens,
  highlights and scrolls to its panel section. Picking is in `src/city/picking.ts`.
- **Written rules this changes.** "Exact ms printed on every building" (CLAUDE.md, R6, T19), "both
  exits always show their speed limit" (T22) and "the modeled tag is always visible" (T21) now hold
  through the panel, which can be hidden. The panel starts open, except below 900 px wide. Wireframes
  and the GPU fill keep a small modeled chip on the map. The rule text has not been edited yet: the
  user decides the wording.
- The black lines had three causes. The band's roof shared a plane with the floor's roof, and black
  outlines were drawn exactly on the faces (z-fighting). The hatch texture was on all six faces at a
  fixed repeat, so it squashed into dense lines on narrow walls. The band was also a slightly larger
  box, which left small steps. Now a floor is a plain segment with a same-size hatched segment on
  top, hatched on its walls only, with stripes in world-size units and in a dark shade of the floor
  color. Floors are told apart by tone, not lines. Block surfaces use `polygonOffset` under outlines.
- The stop 7 view is still a 3D card with its own numbers, because it only shows when opened.
- Headless Chrome with `--use-angle=metal` renders on the real M2 GPU, which is a better check than
  the software GPU used earlier. The Chrome extension was not connected, so nothing here has been
  checked in the user's own browser window.
- Not fixed: inactive exit roads are see-through, so their corners overlap and look slightly brighter.

**Findings from T03, T04 and T05 (numbers and sources are in `docs/probe-results.md`):**

- The gate passed in the user's Chrome 156: 64 elapsed bits, 0 timestamp bits, and GPU time rises with
  cost and pixel count. Stop 6 stays on the timer query, labeled partial.
- **GPU time is not proportional to work.** 4x the loops gave 1.6x to 2.1x the time from `cost-mid` to
  `cost-high`. A GPU clock rising under load is a likely cause, but that is modeled. The city's wording
  must not imply that height means work.
- **Run-to-run noise is large.** `cost-mid` moved 38% across 3 runs, and its readings form several
  clusters. T13 and T16 should keep the spread visible and compare repeats.
- GLSL requires `#version` on the first line, so a shader's header comment goes after it.
- A missing shader can come back as Vite's HTML fallback with status 200, so T09 should check the text,
  not only `response.ok`.
- Beyond the ticket file lists: `src/record/fullscreenTriangle.ts`, `src/probe/shaderProgram.ts` and
  `src/probe/gpuTimingRuns.ts`, split to keep files small. The two `src/probe` files go when T06 deletes
  `src/probe/`. `fullscreenTriangle.ts` stays for the recorder.
- `probe.html` is not a Vite build input, because it is temporary and `no-store` only exists under
  `npm run dev`. Run it with the dev server.
- Not checked: the probe on the LG display, and whether other GPU work was running during these runs.

**Findings from T23 (Day 560 live view, 2026-11-05 and 06, in the user's Chrome on the M2):**

Open it with `npm run dev`, then `/shader.html`. The shaders are only served by the dev server. None of
these runs controlled for other GPU work, and the Chrome extension was attached throughout.

- **Live GPU time, 6 page loads (partial):** Image was steady, with medians of 6.5 to 7.4 ms. Volume A
  moved widely, with medians from about 6.5 to 21 ms. The cause is unknown.
- **Volume A is the unstable, often larger part.** It does far fewer reads (11.9 million modeled, against
  212 million march steps for Image) in as much time or more. Switching render targets 128 times a frame
  could explain that, but this is inferred. Nothing here isolates it.
- **The shader sits at the edge of the 60 Hz budget.** Median time between frames (measured) was about
  16.67 ms on 3 loads, 33.33 ms on 2, and 25.19 ms on 1.
- **Timer readings can exceed the frame time.** On the first load, both passes had a p95 of about 40 ms
  while frames had a p95 of about 17.6 ms. This fits F2: a time range, not busy time.
- **Timing small regions shows the GPU's pattern more than the shader's.**
  - With no sync, the 160 draws each read about 5.8 ms and added up to 102x the whole pass, in one run.
    Each draw seeming to report its whole batch's time is an inference. `readPixels` after each draw
    brought it down to 3.4x to 5.5x, which still fails the page's check.
  - A uniform-cost control (`cost-mid`) shows the same stripes at 16 x 10: columns 0, 3, 4, 7, 8, 11, 12
    and 15 read higher, repeating every 320 px. The grids' left-right patterns correlate at r = 0.76 to
    0.88 across 5 runs. The cause isn't known, so don't call them tiles or cores.
  - Coarser grids add up better in a throwaway test with an empty volume: 16 x 10 was 6.79x, 8 x 5 was
    2.74x and 4 x 3 was 1.38x. A 4 x 3 map is too coarse to be useful.
- **Measured columns loosely follow the modeled march steps.** Rank correlation over the 3 runs saved
  for this comparison was 0.48, 0.47 and 0.72, and the control was -0.35, -0.03 and -0.13. A later run
  with the final code gave 0.44 and -0.04. Plain correlation was lower, at 0.02 to 0.43, with spikes as the likely reason.
  Rank correlation was chosen after seeing that, so treat it as support, not proof. Top to bottom has no
  measured check.
- **`T` never changes in the Image loop,** so `T > .01` never ends a ray early, despite the shader's
  "stop at the fog" comment. Fixing it would change how the shader looks, so the code is untouched.
- **The wrapper is inferred.** The export doesn't say how the volume pass is driven, and the 128 size comes
  from the code. The picture was not compared with Shadertoy's, because that would mean using the site.
- **T09 will list these files.** Its `/shaders/*.glsl` glob will pick up the three `day560-*` files, which
  can't compile alone, so T09 needs a filter or a way to describe multi-pass shaders. T09 to T16 and the
  city also assume one fragment shader. To get Day 560 into the city, decide how a two-pass shader maps
  onto the 8 stops.
- **Written rule stretched.** CLAUDE.md says `record.html` measures and `index.html` draws. This third page
  does both, live, with its panels repainting twice a second. It saves nothing and the city doesn't import
  it, but its numbers are not recording quality. The user should decide whether that wording needs a change.

**Findings from T24 (2026-11-06, in the user's Chrome on the M2, on the LG):**

Open it with `npm run dev`, then `/`. The feed doesn't exist in a production build. None of this is recording
quality, because the city draws at the same time, and the page says so.

- **Decision for the user: CLAUDE.md now disagrees with the app.** It says native tools are out of scope for v0 and
  to "only measure what a page can really measure". The user asked for this view, so it was built, but the
  dev server now reads native counters. The wording should change or the feature should. Not edited yet.
- **Still not real packets.** The table shows HTTP requests, per-connection bytes and per-interface counts.
  `tcpdump` needs root (`/dev/bpf*` is root-only), and so does `powermetrics` for power and cluster clocks.
- **T09 to T16 are still not built.** This view doesn't replace them: a clean recording still needs the city closed.
- **Core numbering is verified, not assumed.** Four background-QoS burns put cpu0-3 at 99% and cpu4-7 at 1 to 18%.
- **Byte direction is verified.** A 45,370-byte download showed `bytes_out` 45,713 and `bytes_in` 92 on the server's row.
- **Compile and link read very low:** about 4.3 ms and 0.5 to 1.5 ms for both passes, on repeat loads. Chrome's program
  cache or deferred work could explain it, which is inferred. T06 hasn't tested it, so `cacheState` stays `unknown`.
- **GPU time here:** about 12 to 16 ms a frame at 20 ms cadence, which fits the LG's 50 Hz. The frame budget holds on this run.
- **Display is inferred from `screen.width`** (2560 or wider means the LG). The 20 ms cadence agreed with it on this run.
- **Page-load connections sent up to 180 KB from Chrome and got about 8 KB back.** Most responses were 304s. Large
  request headers, such as localhost cookies, could explain it, but this wasn't checked.
- **E-core bars can sit behind towers 4 and 5** from the home camera. The E reading stays visible, and orbiting shows them.
- **`/shader.html` still exists** for its cost map. It can go if the user doesn't want it.

**Findings from T25 (2026-11-11, in the user's Chrome on the M2, built-in display, one page load):**

Not recording quality: the city was drawing beside it. Whether another tab was also using the GPU wasn't checked.

- **Day 442 costs more than Day 560 did.** `gpuMs` median was about 39 ms (partial), against 12 to 16 ms for Day 560
  in T24. The whole-Mac GPU reading was 100%. Frames arrived every 34 ms, so about 29 fps on a 60 Hz display.
- **Why, from the code (modeled):** `AA 2` is 4 rays per pixel, each up to 60 steps, each step 5 folds with a
  `cos` and `sin` pair, plus 6 more `map` calls for the normal. At 1280 x 800 that is up to about 270 million `map`
  calls a frame. Changing `AA` to 1 would cut it to about a quarter, but the code is the user's, so it is untouched.
- **The command is tiny next to the work.** `frameCallsMs` was 0.01 ms and `roundTripMs` 0.09 ms, against 39 ms on the
  GPU: a gap of about 4,000x for the call. This is the contrast T26's frame bar should show.
- **Build trip:** fetch 8.1 ms for 2 files (measured), compile 85.6 ms, link 6.2 ms, first draw 2.5 ms (all partial).
  Compile is far above Day 560's 4.3 ms, which fits that being a cache hit, but T06 still hasn't tested the cache.
- **`steadyDrawMs` read 124.6 ms.** It forces a wait for the GPU, which already had frames queued, so it is about
  3 frames of work. It isn't a baseline for this shader. Decide in T12 whether to keep it.
- **Day 560 is no longer in the city.** `/shader.html` still runs it. `dayRenderer.ts`, `loadPasses.ts` and
  `wrapVolumePass` are now used only by that page.
- **The wrapper still declares `iChannel0` and `uSlice`,** which Day 442 doesn't use. Harmless, but they are part of
  the text that gets compiled.
- Not checked: the LG display, and a run with the city tab closed.

---

# Reference

## R1. Project brief

**The app:** shows the path of one GLSL fragment shader on the user's Mac as a 3D city. The ground
is a schematic map of the M2 chip. The 8 pipeline stops sit on the hardware blocks where they
run. Roads are handoffs. Building height is measured time. It records first, then replays, so the
city's own rendering doesn't distort the numbers.

**Constraints:**
- Vanilla Three.js + Vite + TypeScript. No React.
- Shaders come from local `./shaders/*.glsl` files only. No scraping Shadertoy.
- Only measure what a page can really measure.
- For each stop, say measured, partial or modeled. Never present a modeled number as measured.
- Native tools (Instruments, tshark) are out of scope for v0, but keep the JSON import slot.
- Never put device identifiers (serial, UUID, UDID) in code, logs or commits.
- Small files, one job each. Code comments go on their own line above the code.
- Label every number with its source. Mark anything inferred as "modeled".
- Draw our own blocks. Don't copy or trace a die shot.
- CLAUDE.md stays under 200 lines.

**The user's machine (from `system_profiler` and `chrome://gpu`, taken as given):**
- MacBook Pro 13" (Mac14,7), Apple M2, Chrome 156.
- CPU: 8 cores = 4 performance + 4 efficiency.
- GPU: 10 cores, each 128 ALUs, Metal 4.
- Unified memory: 8 GB.
- Display 1: built-in Retina 2560 x 1600, 60 Hz.
- Display 2: LG ultrawide 3440 x 1440, 50 Hz.
- `GL_RENDERER` = ANGLE Metal Renderer: Apple M2, `angle=metal`, in-process GPU = false,
  `GL_EXT_disjoint_timer_query` and `KHR_parallel_shader_compile` available.

**The 8 stops:** 1 Network, 2 Renderer process, 3 GPU process, 4 ANGLE, 5 Metal compiler,
6 GPU tiles/cores, 7 SIMD groups, 8 Compositor + display.

**Findings that changed the brief:**

- **F1. Stop 5 happens in two places.** In ANGLE's Metal backend, compile translates GLSL to MSL
  (`ShaderMtl.mm`). Link builds the `MTLLibrary` (`ProgramMtl.mm`). The first draw creates the
  render pipeline state (`ProgramExecutableMtl::setupDraw`, then
  `mtl_pipeline_cache.mm` `newRenderPipelineStateWithDescriptor`). Stop 5 has two floors.
- **F2. One GPU number only.** `DisplayMtl.mm` sets 64 bits for time elapsed and 0 for timestamps.
  `TIME_ELAPSED` sums `GPUEndTime - GPUStartTime` per Metal command buffer
  (`mtl_command_buffer.mm`). That is a time range, not busy time. `beginQuery` and `endQuery`
  flush for a clean boundary (`QueryMtl.mm`), which is also an observer effect. Requesting a
  result early makes ANGLE wait. Stops 6 and 7 can't be separated, so stop 7 is modeled.
- **F3. `gl.finish()` doesn't block in Chrome.** Blink's source says
  `Flush(); // Intentionally a flush, not a finish.` Use `readPixels` to wait for the GPU.
- **F4. `GPU_DISJOINT_EXT` is always 0 on Metal** (`ContextMtl::getGPUDisjoint`). Use statistics
  and repeat runs.
- **F5. Local files never touch Wi-Fi.** A file from `localhost` uses loopback.
- **F6. 4 x 32 is the recommended core drawing.** It connects to stop 7's 32-thread group.
  The 4 means per-cycle dispatch: metal-benchmarks lists 384 to 3072 threads per core, which is
  12 to 96 SIMD groups. 16 x 8 is also 128 but comes only from Wikipedia.
- **F7. Per-core lighting can't be shown honestly.** A page has no per-core or ALU counters, and
  a full-screen shader covers every tile whatever it costs. Extra cost mostly shows as time.
- **F8. The page can't see P versus E cores.** Stops 2 to 5 sit on the CPU district, not a cluster.
  The brief's "on CPU cores" is met at district level, and any cluster placement is modeled.
- **F9. Caches exist at several levels.** ANGLE's program cache, `LibraryCache` (keyed on translated
  MSL), the pipeline cache, Chrome's disk cache and macOS's Metal cache. Label each recording `cold`,
  `warm` or `unknown`, and never claim `cold` without proof.

## R2. M2 hardware map

```
 OFF-CHIP   Wi-Fi 6 radio                 Vite dev server (this Mac)
            unused by local files         serves ./shaders/*.glsl
                 :                                |
                 : dimmed road                    | lit road (loopback)
                 :..[1 NETWORK]-------------------+
                     |
+====================|======== UNIFIED MEMORY RING: 8 GB, 100 GB/s ========+
|                    v                                                     |
|  +----------- CPU DISTRICT -----------+  +------- GPU DISTRICT --------+ |
|  | P cluster (4)      E cluster (4)   |  | 10 cores, 128 ALUs each     | |
|  | L2 16 MB           L2 4 MB         |  | [c][c][c][c][c]             | |
|  |                                    |  | [c][c][c][c][c]             | |
|  | Stops sit on the district, because |  | [6] tiles land on cores     | |
|  | a page can't see which core runs:  |  |                             | |
|  |                                    |  | Inside one core:            | |
|  | [2] Renderer   [3] GPU process     |  | 4 x 32 lanes = 128 ALUs     | |
|  | [4] ANGLE      [5] Metal compiler  |  | [7] SIMD group: 32 threads  | |
|  +------------------------------------+  +-----------------------------+ |
|  +------------- SYSTEM-LEVEL CACHE: 8 MB, shared with GPU -------------+ |
|  +--------------+  +--------------+  +---------------------------------+ |
|  | Neural       |  | Media        |  | DISPLAY ENGINES  [8]            | |
|  | Engine       |  | engine       |  | + compositor (schematic)        | |
|  | 16 cores     |  |              |  | dcp            dcpext           | |
|  | not on route |  | not on route |  | |              |                | |
|  +--------------+  +--------------+  +---------------------------------+ |
+========================================|==============|==================+
                                         v              v
                                 built-in: 60 Hz limit  LG: 50 Hz limit
                                 16.67 ms per frame     20.00 ms per frame
```

## R3. Source and basis for each number

| Number | Source | Basis |
|---|---|---|
| 4P + 4E, 10 GPU cores, 16-core Neural Engine, 8 GB, 100 GB/s | Apple Support M2 specs | published |
| 60 Hz, 50 Hz | User's confirmed setup, cross-checked by rAF timing each run | this-machine |
| 128 ALUs per core | metal-benchmarks, reporting Apple's description | community |
| 4 x 32 layout | metal-benchmarks: 4 schedulers, each dispatching from one 32-thread SIMD group | community |
| 16 EUs x 8 ALUs | Wikipedia | community |
| 8 MB system-level cache | metal-benchmarks and Wikipedia; not in Apple's press release | community |
| P L2 16 MB, E L2 4 MB | Wikipedia, citing AnandTech | community |
| GPU L2 about 1.5 MB, about 1.398 GHz | metal-benchmarks (approximate; not drawn on the map) | community |
| 1 `dcp` + 1 `dcpext` | Asahi docs | community |
| `dcp` drives built-in, `dcpext` drives LG | Inferred from Asahi's routing table | modeled |
| Wi-Fi off-chip | Asahi firmware table and M2 13" Broadcom driver commit | community |
| Tile sizes 32x32, 32x16, 16x16 | Apple `tileWidth` docs; the actual size used is modeled | published |
| 1,000 tiles, 32,000 SIMD groups | Calculated at 1280 x 800 | modeled |

The schema's `basis` has no "secondary" value, so Wikipedia numbers use `community`, and the
`source` text names Wikipedia.

## R4. Stop table

| Stop | Hardware block | What it represents | Browser API | Status | Metric ids |
|---|---|---|---|---|---|
| 1 Network | Network road | Fetching the shader over loopback | `PerformanceResourceTiming` | **Measured**, loopback only | `fetchMs` |
| 2 Renderer | CPU district | JS time issuing WebGL calls | `performance.now()` | **Measured**; core placement modeled | `buildCallsMs`, `frameCallsMs` |
| 3 GPU process | CPU district | Crossing into the GPU process | `getError()` flush and round trip | **Partial**: a proxy | `roundTripMs` |
| 4 ANGLE | CPU district | GLSL validation and translation | `compileShader`, blocking `COMPILE_STATUS` | **Partial**: includes stops 2 and 3 overhead | `compileMs` |
| 5 Metal compiler | CPU district | Floor 1: link and `MTLLibrary`. Floor 2: first-draw pipeline | Blocking `LINK_STATUS`; first draw plus `getError()` | **Partial**: includes ANGLE link work | `linkMs`, `firstDrawMs`, `steadyDrawMs` (baseline, not a floor) |
| 6 GPU tiles | GPU cores | GPU time for the draw | `EXT_disjoint_timer_query_webgl2`, `TIME_ELAPSED_EXT` | **Partial**: total measured; tiles and core mapping modeled | `gpuMs`, `gpuMsWarmup` |
| 7 SIMD groups | Inside a GPU core | Pixels divided into 32-thread groups | None | **Modeled only** | `tileCount`, `simdGroups` |
| 8 Compositor + display | Display engines | Frame cadence and speed limit | rAF deltas | **Partial**: cadence measured; compositor and scanout time not | `frameDeltaMs`, `refreshHz` |

The metric ids are proposals made for these tickets. The schema only requires that they are strings.

## R5. Roads and data flow

**Roads.** The shader makes two trips, not one straight line:

```
BUILD TRIP: once per shader
[1 Network] --> [2 Renderer] --> [3 GPU process] --> [4 ANGLE] --> [5 Metal compiler]
 source text     JS gl calls      command buffer      GLSL to MSL    link: MTLLibrary
                                                                     first draw: pipeline
                                                                            |
                                              compiled pipeline waits in unified memory
                                                                            |
FRAME LOOP: every frame                                                     v
   +--> [2 Renderer] --> [3 GPU process] --> [6 GPU tiles] --> [7 SIMD groups]
   |     draw call        command buffer      tile work         32 threads each
   |                                                                 |
   +------------ next rAF <--- [8 Compositor + display] <------------+
```

Stops 2 and 3 appear on both trips. The city draws them as one building with two lanes. Road
lengths are layout only, because no road has a measured time.

**Data flow:**

```
./shaders/*.glsl
      | fetch, no-store
      v
record.html: raw WebGL2, no Three.js, nothing animating
  probe environment --> stop 1 --> stops 2-5 --> stops 6-8
      |
      v
validate against schema --> download recording JSON --> ./recordings/
                                                             |
later: Instruments or tshark summaries --> imports[] slot ---+
                                                             v
index.html: city, never measures anything
  validate --> pure layout function --> Three.js scene --> replay
```

These are separate pages. `src/city` must not import from `src/record`, and the city tab stays
closed during recording. Native data sits beside browser numbers and never overwrites them.

**File tree at the end of v0:**

```
kuko-code/
├─ CLAUDE.md                  under 200 lines
├─ docs/
│  ├─ backlog.md              this file
│  └─ probe-results.md        findings from T04 to T06
├─ package.json
├─ tsconfig.json
├─ vite.config.ts             COOP/COEP headers, no-store on shaders
├─ index.html                 city page
├─ record.html                recorder page
├─ shaders/                   reference shaders and the user's .glsl files
├─ recordings/                saved JSON
├─ schema/recording.schema.json
├─ data/hardware-map.m2.json  blocks, numbers, sources
├─ src/
│  ├─ shared/
│  │  ├─ types.ts             recording types
│  │  └─ validateRecording.ts schema check, identifier scan
│  ├─ record/
│  │  ├─ main.ts              runs the sequence
│  │  ├─ probeEnvironment.ts  extensions, bits, renderer
│  │  ├─ fetchShader.ts       stop 1
│  │  ├─ measureCallTime.ts   stop 2
│  │  ├─ measureRoundTrip.ts  stop 3
│  │  ├─ measureCompile.ts    stop 4
│  │  ├─ measureLink.ts       stop 5, floor 1
│  │  ├─ measureFirstDraw.ts  stop 5, floor 2
│  │  ├─ measureGpuTime.ts    stop 6
│  │  ├─ modelSimdGroups.ts   stop 7
│  │  ├─ measureRefresh.ts    stop 8
│  │  ├─ summarize.ts         min, median, p95, max
│  │  └─ saveRecording.ts     JSON download
│  └─ city/
│     ├─ main.ts              scene setup
│     ├─ loadRecording.ts     file picker, validation
│     ├─ layoutMap.ts         blocks to positions, pure
│     ├─ heightScale.ts       ms to height, pure
│     ├─ buildBlocks.ts       hardware ground
│     ├─ buildStops.ts        stop buildings
│     ├─ buildRoads.ts        both trips
│     ├─ buildGpuDistrict.ts  10 cores, zoom view
│     ├─ buildLabels.ts       value, status, source
│     └─ replay.ts            slowed playback
└─ tests/                     validator, summarize, models, heightScale, layoutMap
```

Dependencies beyond Vite, TypeScript and Three.js: `ajv` and `ajv-formats`, plus Vitest for tests.
`probe.html` and `src/probe/` exist only from T04 until the end of T06.

## R6. Honesty rules for the city

- A value can't render without a status and a source.
- Measured = solid. Partial = solid with a hatched band. Modeled = wireframe with a "modeled" tag.
- Stop 7 has no height of its own, so GPU time is never counted twice.
- Stop 8 has no time-based height: its compositor time is unknown.
- Heights use a log scale, with exact ms printed on every building.
- One-shot build values and per-frame values use different colors.
- The map is labeled schematic. The compositor's placement on the display engines is schematic too.

## R7. JSON schema for one recording

Compiled in Ajv strict mode. A valid sample passed. Samples with 1 stop, an injected `serial`
key, a bad status and an absolute shader path were all rejected.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "shader-pipeline-city/recording-v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "recordedAt", "environment", "capture",
               "shader", "hardwareMap", "stops", "imports"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "recordedAt": { "type": "string", "format": "date-time" },
    "environment": { "$ref": "#/$defs/environment" },
    "capture": { "$ref": "#/$defs/capture" },
    "shader": { "$ref": "#/$defs/shader" },
    "hardwareMap": { "$ref": "#/$defs/hardwareMap" },
    "stops": {
      "type": "array", "minItems": 8, "maxItems": 8,
      "items": { "$ref": "#/$defs/stop" }
    },
    "imports": { "type": "array", "items": { "$ref": "#/$defs/import" } }
  },
  "$defs": {
    "environment": {
      "type": "object",
      "additionalProperties": false,
      "required": ["browserMajor", "glRenderer", "timerQueryExposed",
                   "parallelCompileExposed", "timeElapsedBits", "timestampBits"],
      "properties": {
        "browserMajor": { "type": "integer" },
        "glRenderer": { "type": "string" },
        "timerQueryExposed": { "type": "boolean" },
        "parallelCompileExposed": { "type": "boolean" },
        "timeElapsedBits": { "type": "integer" },
        "timestampBits": { "type": "integer" }
      }
    },
    "capture": {
      "type": "object",
      "additionalProperties": false,
      "required": ["cacheState", "drawingBuffer", "devicePixelRatio", "display",
                   "warmupFrames", "sampledFrames", "crossOriginIsolated"],
      "properties": {
        "cacheState": { "enum": ["cold", "warm", "unknown"] },
        "drawingBuffer": {
          "type": "object",
          "additionalProperties": false,
          "required": ["width", "height"],
          "properties": {
            "width": { "type": "integer", "minimum": 1 },
            "height": { "type": "integer", "minimum": 1 }
          }
        },
        "devicePixelRatio": { "type": "number" },
        "display": { "enum": ["built-in", "lg", "unknown"] },
        "warmupFrames": { "type": "integer", "minimum": 0 },
        "sampledFrames": { "type": "integer", "minimum": 1 },
        "crossOriginIsolated": { "type": "boolean" }
      }
    },
    "shader": {
      "type": "object",
      "additionalProperties": false,
      "required": ["file", "bytes", "sha256"],
      "properties": {
        "file": { "type": "string", "pattern": "^shaders/[^/]+\\.glsl$" },
        "bytes": { "type": "integer", "minimum": 0 },
        "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" }
      }
    },
    "hardwareMap": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "schematic", "blocks"],
      "properties": {
        "id": { "type": "string" },
        "schematic": { "const": true },
        "blocks": { "type": "array", "items": { "$ref": "#/$defs/block" } }
      }
    },
    "block": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "label", "offChip", "numbers"],
      "properties": {
        "id": { "type": "string" },
        "label": { "type": "string" },
        "parentId": { "type": "string" },
        "offChip": { "type": "boolean" },
        "numbers": { "type": "array", "items": { "$ref": "#/$defs/specNumber" } }
      }
    },
    "specNumber": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "value", "unit", "basis", "source"],
      "properties": {
        "name": { "type": "string" },
        "value": { "type": "number" },
        "unit": { "type": "string" },
        "basis": { "enum": ["published", "community", "this-machine", "modeled"] },
        "source": { "type": "string", "minLength": 1 }
      }
    },
    "stop": {
      "type": "object",
      "additionalProperties": false,
      "required": ["stop", "name", "blockId", "status", "metrics", "floors"],
      "properties": {
        "stop": { "type": "integer", "minimum": 1, "maximum": 8 },
        "name": { "type": "string" },
        "blockId": { "type": "string" },
        "status": { "$ref": "#/$defs/status" },
        "metrics": { "type": "array", "items": { "$ref": "#/$defs/metric" } },
        "floors": {
          "description": "Metric ids stacked as building floors. Must be ms metrics.",
          "type": "array", "items": { "type": "string" }
        }
      }
    },
    "status": { "enum": ["measured", "partial", "modeled"] },
    "metric": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "value", "unit", "status", "source"],
      "properties": {
        "id": { "type": "string" },
        "value": { "type": ["number", "null"] },
        "unit": { "enum": ["ms", "Hz", "count", "bytes", "percent"] },
        "status": { "$ref": "#/$defs/status" },
        "source": { "type": "string", "minLength": 1 },
        "stats": {
          "type": "object",
          "additionalProperties": false,
          "required": ["n", "min", "median", "p95", "max"],
          "properties": {
            "n": { "type": "integer", "minimum": 1 },
            "min": { "type": "number" },
            "median": { "type": "number" },
            "p95": { "type": "number" },
            "max": { "type": "number" }
          }
        },
        "note": { "type": "string" }
      }
    },
    "import": {
      "type": "object",
      "additionalProperties": false,
      "required": ["tool", "stop", "metrics"],
      "properties": {
        "tool": { "enum": ["instruments", "tshark", "other"] },
        "stop": { "type": "integer", "minimum": 1, "maximum": 8 },
        "metrics": { "type": "array", "items": { "$ref": "#/$defs/metric" } }
      }
    }
  }
}
```

## R8. Risks and unknowns

| Risk | Why it matters | Response |
|---|---|---|
| **Observer effect: blocking calls** | `COMPILE_STATUS` and `getError` stall and change the normal flow | Recorder only, labeled partial, documented in the app |
| **Observer effect: timer query** | ANGLE flushes at begin and end, splitting command buffers | Compare frames with and without the query (T05) |
| **Observer effect: reading too soon** | Requesting a result early makes ANGLE wait for the GPU | Check `QUERY_RESULT_AVAILABLE` on later frames first |
| **Observer effect: the city** | Rendering the city would use the GPU being measured | Separate pages, city tab closed during recording |
| **Other GPU users** | `TIME_ELAPSED` uses command-buffer start and end times, so other work may inflate it (inference) | Close other apps, repeat runs, report median and p95 |
| **Shader caches** | Repeat runs get faster; a comment change may not force a recompile | Change real code for cold runs, test in T06, otherwise label `unknown` |
| **macOS Metal cache** | Its behavior isn't visible from a page | Never claim a truly cold driver compile; `--disable-gpu-shader-disk-cache` only covers Chrome's cache |
| **Source vs the user's build** | ANGLE and Chromium `main` were read, not Chrome 156's exact code | T04 to T06 test the real behavior |
| **Extension exposure** | `chrome://gpu` lists the GL extension; the WebGL2 one is unconfirmed | T04 checks first |
| **Undetected GPU interruptions** | The disjoint flag is always 0 | Warmup frames, repeat runs, outlier stats |
| **Power and thermal state** | Clock changes can shift results, and no API reports them (inference) | Stay plugged in, space runs apart, compare repeats |
| **Timer resolution** | `performance.now()` is 100 µs by default, 5 µs when isolated; rAF may be 1 ms; the browser may coarsen GPU timers | Set COOP/COEP, use medians over many frames |
| **Query results arrive late** | Results come back frames after the draw | Match results to queries, handle pending ones at the end |
| **Pixel count** | Each display and scaling mode changes the buffer size | Fix the buffer at 1280 x 800, record DPR |
| **Refresh rate** | A page sees only the window's current display, and can't read the rate directly | One recording per display, compare to known 60 and 50 Hz |
| **Mixed time scales** | Compile may dwarf per-frame GPU cost on a linear scale | Log height, exact ms printed, different colors per trip |
| **Compositor placement** | It likely doesn't run only on display engines; not verified | Label stop 8 as schematic |
| **Baseline contamination** | Link time includes the fixed vertex shader | Record `trivial.glsl` as a reference |
| **P and E cores invisible** | A page can't see where work runs | Stops sit on the CPU district |
| **Memory pressure** | 8 GB is shared by CPU and GPU, so other apps may affect runs (inference) | Close heavy apps, compare repeats |
| **Secondary sources** | Some numbers aren't from Apple | The `basis` field and source labels show this |
| **Native imports** | Traces and captures can carry identifiers | Accept summary metrics only, never raw files |

## R9. Sources checked

**Listed in the brief:**
- [Apple M2 press release](https://www.apple.com/newsroom/2022/06/apple-unveils-m2-with-breakthrough-performance-and-capabilities/):
  10-core GPU, 100 GB/s, 20 billion transistors, 15.8 trillion Neural Engine operations per second, media
  engine. It doesn't give cache size, ALU count or core split.
- Apple Metal: [TBDR guide](https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering),
  [`tileWidth`](https://developer.apple.com/documentation/metal/mtlrenderpassdescriptor/tilewidth),
  [`GPUStartTime`](https://developer.apple.com/documentation/metal/mtlcommandbuffer/gpustarttime).
  Read through Apple's DocC JSON because the normal fetch came back empty.
- [metal-benchmarks](https://github.com/philipturner/metal-benchmarks): ALU layout, 32-thread SIMD
  groups, threads per core, 8 MB L3, about 1.5 MB GPU L2, 1.398 GHz. Community research, not Apple's docs.
- Asahi docs: [GPU notes](https://asahilinux.org/docs/hw/soc/agx/),
  [display controllers](https://asahilinux.org/docs/hw/soc/display-controllers/),
  [firmware overview](https://asahilinux.org/docs/platform/introduction/),
  [Apple PCIe](https://asahilinux.org/docs/hw/soc/apcie/).
- Khronos: [timer query](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/),
  [parallel compile](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/).
- MDN: [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices),
  [`finish`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/finish),
  [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming),
  [`performance.now`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now),
  [rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
  [timer query](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query),
  [parallel compile](https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile).

**Extras:**
- [ANGLE Metal backend](https://github.com/google/angle/tree/main/src/libANGLE/renderer/metal), `main`
  branch, read 2026-11-05: `QueryMtl.mm`, `mtl_command_buffer.mm`, `DisplayMtl.mm`, `ContextMtl.mm`,
  `ProgramMtl.mm`, `ShaderMtl.mm`, `ProgramExecutableMtl.mm`, `mtl_pipeline_cache.mm`; also
  `src/libANGLE/MemoryProgramCache.cpp`.
- [Blink WebGL source](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc): `finish()`.
- [Chromium GPU switches](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_switches.cc): the shader disk cache flag.
- [Apple Support M2 specs](https://support.apple.com/en-us/111869),
  [Wikipedia: Apple M2](https://en.wikipedia.org/wiki/Apple_M2),
  [M2 13" Wi-Fi driver commit](https://github.com/AsahiLinux/linux/commit/fc9ce1571a61ab3b35402037812758f0380f1593).

**Not verified:**
- How the macOS Metal cache behaves.
- Which process and hardware the compositor uses.
- The user's machine details, including Metal 4, which were taken as confirmed.

**Checked since:** T04 and T05 ran in the user's Chrome 156. Results are in `docs/probe-results.md`.
