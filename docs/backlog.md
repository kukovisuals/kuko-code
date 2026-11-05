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
- [ ] T03 Add reference shaders

**Prove the timers (T05 is a gate)**
- [ ] T04 Probe the environment
- [ ] T05 Prove GPU timing works
- [ ] T06 Test the shader caches

**Data contract**
- [ ] T07 Schema, types and validator
- [ ] T08 Hardware map JSON

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
- [ ] T17 Ground blocks
- [ ] T18 Labels with sources
- [ ] T19 Stop buildings from a recording
- [ ] T20 Roads for both trips
- [ ] T21 GPU district and stop 7 zoom
- [ ] T22 Replay and display comparison

## 3. Open decisions

The user has not answered these yet. Build with the default unless they say otherwise.
Update this table when they answer.

| ID | Question | Default | Affects |
|---|---|---|---|
| D1 | How does the GPU district show a heavier shader? | All 10 cores light together. Fill = `min(gpuMs / frameBudgetMs, 1)`, tagged modeled. Replaces the brief's "lights more of each core". | T21 |
| D2 | What does the network road show? | Lit loopback road, plus a dimmed Wi-Fi road labeled "unused by local files". Keeps the local-files rule. Measuring real Wi-Fi would mean serving the files from another machine. | T17, T20 |
| D3 | What format are shaders in, and which will the user supply? | Plain `#version 300 es` fragment shader with `u_time` and `u_resolution`. Shadertoy-style `mainImage` would need a wrapper that becomes part of what is compiled. | T03, T09 |

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

## 5. Parking lot

New ideas or out-of-scope findings go here, not into the current ticket.

- After v0: import native summaries from Instruments or tshark through `imports[]`.
  Summaries only, never raw traces, which can contain identifiers.

**Findings from T02:**

- Pinned versions: Vite 8.3.6, TypeScript 7.0.2, Three.js 0.187.0, `@types/three` 0.187.0.
- Vite 8 uses Rolldown, so build inputs go under `build.rolldownOptions`, not `rollupOptions`.
- `tsconfig.json` needs `moduleDetection: "force"`. Without it, a `main.ts` with no import or
  export is treated as a global script, and the two pages' top-level names clash.
- `.glsl` files are served with an empty `Content-Type`. `fetch().text()` still returned the raw
  body in a `curl` check. T03 should confirm this in the browser.
- The `no-store` middleware is on the dev server only, so run the recorder under `npm run dev`.

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
- Whether Chrome 156 exposes the WebGL2 timer extension on this Mac, and how accurate it is (T04, T05).
- How the macOS Metal cache behaves.
- Which process and hardware the compositor uses.
- The user's machine details, including Metal 4, which were taken as confirmed.
- No probe has been run in the user's Chrome yet.
