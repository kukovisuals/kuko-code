# Focus

**Written:** 2026-11-11. Based on the job research from the same day (sources at the bottom).
**Revised:** 2026-11-11. The seven tools became one major output: a WebGPU viewer for large
scenes. The shader cost profiler and the Three.js frame inspector moved to the parking lot.
Section 2 says why.

## 1. The direction

> **Build real-time graphics renderers for the browser that stay fast on huge scenes, and
> prove it with measurements.**

Everything I build, write and learn has to point this way. If a piece of work doesn't make me
better at building a browser renderer, or doesn't measure one honestly, it is off the vector
and goes in the parking lot (section 9).

Short name for it: **own the renderer, measure the frame.**

## 2. Why this direction and not another

Think of each job as a vector of skills. I only have one vector of effort. What a job gets from
me is the dot product: how much of my effort points along what they ask for. I can't point at
15 jobs separately, so I pick the single direction that overlaps most with all of them.

What the postings ask for most often:

| Ask | Roles | Count |
|---|---|---|
| Three.js | 3, 6, 8, 9, 11–15 | 10 (I already have it) |
| WebGPU | 1, 3, 4, 5, 6, 9, 10 | 7 |
| Large scenes, viewers, digital twins, maps | 3, 4, 6, 7, 8, 9, 10 | 7 |
| Owning a renderer, not just using one | 1, 2, 4, 6 | 4 |
| GPU profiling by name | 2, 4, 10 | 3 |

**What changed in the revision, and why:**

- **The renderer comes first, measurement goes inside it.** The postings ask for people who
  *build* fast renderers. Only 3 ask for profiling by name. So measurement is how I prove the
  renderer is fast, not a product of its own yet.
- **The shader cost profiler was dropped.** Per-line cost can't be measured honestly in a
  browser. In T29, switching parts of a shader off gave a clear saving only for `AA`. A per-line
  table would be mostly modeled numbers.
- **The Three.js frame inspector was dropped.** Spector.js, stats-gl, r3f-perf and
  `renderer.info` already cover most of it.
- **The creative roles (11–15) are not on this vector.** Performance isn't what they ask for.
  I already qualify through GLSL and Three.js, and the daily posts (section 6) are my portfolio
  for them.

**One limit to be honest about.** A single direction can't score 100% on every job. Three asks
sit almost at right angles to this one: TouchDesigner, Unreal, and deep Skia internals. I
cover them last and lightly (section 4, "Off the vector").

## 3. The roles

Pay is base salary as listed in the postings found on 2026-11-11. "n/l" means not listed.
"Opened by" is the stage (section 5) after which I can apply with real proof.

| # | Company | Role | Pay | Needs C++? | Opened by |
|---|---|---|---|---|---|
| 1 | Adobe (3D Labs) | Realtime Rendering & Graphics Engineer | up to ~$312K | yes | Native core |
| 2 | Figma | SWE, Rendering & Animation | $149–350K | yes (C++/WASM) | Native core |
| 3 | Apple (apple.com) | Sr SWE, Front End, Real-Time 3D | $181–272K | no | Viewer S4 |
| 4 | Apple Maps | Sr Rendering Engine SWE | n/l | yes | Native core |
| 5 | Google Chrome / Skia | Sr SWE, Graphics & Text | $174–252K | yes | Native core |
| 6 | Applied Intuition | SWE, Maps Rendering | $175–230K | no | Viewer S5 |
| 7 | Autodesk | Sr SWE, Computer Graphics | n/l | no | Viewer S5 |
| 8 | Matterport / CoStar | Sr SWE 3D Experiences, Sr SDK Engineer | n/l | no | Viewer S6 |
| 9 | Symbotic | Sr 3D Web Engineer | n/l | no | Viewer S5 |
| 10 | Avala.ai | WebGPU Graphics Engineer | n/l | no | Viewer S3 |
| 11 | Fanatics | Sr Creative Technologist | $145–181K | no | today |
| 12 | Google Gemini social | Creative Technologist (temp) | n/l | no | today |
| 13 | MATTE Projects | Creative Technologist | $130–150K | no | today |
| 14 | Hovercraft | Creative Technologist (freelance) | n/l | no | today |
| 15 | Spline | JS Developer, 3D Graphics (contract) | n/l | no | today |

**Main targets:** 3, 6, 7, 8, 9, 10. **Next tier, after the native core:** 1, 2, 4, 5.
**Fallback if I need work sooner:** 11–15.

## 4. Every requirement, and what proves it

This is the coverage check. Every skill the postings asked for is a row. Every row names the
output (section 5) that produces public proof of it. A row with no proof is a gap.

Status: **have** = I can show it today. **part** = started. **gap** = nothing to show yet.
Proof: **City** = Shader Pipeline City. **S1–S6** = viewer stages. **Native** = native core.
**Posts** = daily posts.

### Core web graphics

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| GLSL shaders, custom effects | 2, 3, 11, 14, 15 | have | City, Posts |
| WebGL / WebGL2 | almost all | have | City |
| Three.js | 3, 6, 8, 9, 11–15 | have | Posts, S6 (adapter) |
| TypeScript | 6, 8 | have | City, every stage |
| React, React Three Fiber | 6, 8, 14, 15 | part | S6 (R3F wrapper) |
| Shadertoy background | 11 | have | Posts |
| SDFs | 1 | part | Posts, Native |

### Performance

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| GPU profiling and timing | 2, 4, 10 | part | City, S1 |
| Batching and draw calls | 2 | gap | S2 |
| 120fps target, frame budgets | 6 | gap | S2, S5 |
| Browser compositing | 3 | part | City (stop 8) |
| Performance work on large scenes | 7, 8, 9 | gap | S5 |
| Data-oriented design | 1 | gap | S2, Native |

### WebGPU

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| WebGPU | 1, 3, 4, 5, 6, 9, 10 | gap | S1–S6 |
| WGSL | 3, 4 | gap | S1–S4 |
| Owning a renderer, not just using one | 1, 2, 4, 6 | gap | S1–S6, Native |
| New rendering algorithms | 1 | gap | S3 (splat sort on compute) |

### 3D content and scenes

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| Gaussian splats, point clouds | 3, 10 (+ Matterport, Snap) | gap | S2, S3 |
| glTF / Draco | 11 | gap | S4 |
| PBR | 3 | gap | S4 |
| Digital twins, web viewers | 7, 8, 9 | gap | S5, S6 |
| Maps rendering | 4, 6 | gap | S5 (tiled, streamed loading) |
| Shipping an SDK | 8 | gap | S6 |

### 2D, text and native

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| Anti-aliasing | 2 | gap | Native |
| Text and font rendering | 5 | gap | Native |
| Canvas2D | 5 | have | Native (as the baseline to beat) |
| C++ or Rust compiled to WASM | 1, 2, 4, 5 | gap | Native |
| Metal / Vulkan, MSL | 1, 4 | gap | Native (wgpu runs on Metal) |

### Creative (fallback track, not on the vector)

| Requirement | Asked by | Status | Proved by |
|---|---|---|---|
| Particles and VFX | 11 | part | Posts, S2 (instanced points) |
| Animation state machines | 11 | gap | Parked |
| WebXR | 3, 12 | gap | Parked |
| Gemini API | 12 | gap | Parked |
| Babylon.js | 11 (as an alternative) | gap | Parked |

### Off the vector (last, and light)

| Requirement | Asked by | Plan |
|---|---|---|
| TouchDesigner | 13, 14 | One weekend piece that feeds a web shader. Enough to say yes honestly. |
| Unreal | 13 | Skip unless a specific job I want requires it. |
| Skia internals | 5 | Read the source while building the native core and write about it. No separate project. |
| "5+ years of WebGL" | 7 | Can't be built. Shipped work and public numbers stand in for years. |

## 5. The outputs

Three outputs, in order. Each one gives me the fundamentals for the next. I finish one before
starting the next, and inside an output I finish one stage before starting the next.

**Rule for every stage:** it ships with a public URL, a README, real numbers labeled measured /
partial / modeled, and at least one post explaining how it works.

### Output 0: Shader Pipeline City (closed as-is, 2026-11-12)

Shows where one fragment shader spends its time, from fetch to screen, on real hardware.
**Done when:** closed as-is on 2026-11-12 at the user's request. T11–T16, T35 and T36 were
removed from `docs/backlog.md`, so the city never shows a real recording and has no public
release. T28 and T30 keep their findings. T26, T31 and T32 are in the backlog's parking lot.
**Gives the next output:** GPU timer queries (T05) and the measured / partial / modeled labels.
The recording protocol (old T16) was never built, so Stage 1 has to design its own.

### Output 1: WebGPU viewer for large scenes (the major output)

A renderer written in raw WebGPU and WGSL with TypeScript, not on top of Three.js, so I own
every part of it. It shows its own GPU time on every frame. Each stage depends on the one
before it.

**S1. Triangle with GPU timing.**
Adapter, device, pipeline, WGSL, and GPU time per frame from WebGPU timestamp queries. Chrome
rounds these timestamps by default, so record the resolution I actually get and label it.
If timestamp queries aren't available, fall back to frame time and label it partial.
**Done when:** one triangle renders, and its GPU time shows with a status and a source.

**S2. A million instanced points.**
Instancing, storage buffers, frustum culling (on the CPU first, then in a compute shader) and a
fixed frame budget.
**Done when:** 1M points render, and the cost with culling on and off is measured.

**S3. Gaussian splats.**
Load a public splat scene, sort the splats by depth in a compute shader, and blend them. This
is the thing WebGL can't do well.
**Done when:** a public splat scene renders, with the sort's cost measured separately from
drawing.

**S4. Meshes.**
glTF and Draco loading with metallic-roughness PBR, drawn in the same frame as the splats.
**Done when:** a standard glTF sample model renders with correct PBR next to a splat scene.

**S5. Streaming a scene too big for memory.**
Tiles, level of detail, and loading driven by the frame budget.
**Done when:** a scene too big to load at once holds 60fps on this Mac (target 120), measured.

**S6. SDK.**
An npm package with a small embed API, a Three.js adapter and an R3F wrapper.
**Done when:** a stranger can embed a scene with the README's example of 10 lines or fewer.

**Speaks to:** Apple, Applied Intuition, Autodesk, Matterport, Symbotic and Avala fully, and
Adobe and Apple Maps partly.
**Gives the next output:** a working renderer whose core can be ported to native code.

### Output 2: native core

Port the viewer's core to Rust with wgpu. The same code compiles to WASM for the browser and
runs natively on Metal. Add a small 2D vector and text renderer with good anti-aliasing,
compared against Canvas2D.
**Done when:** the same scene renders in the browser and natively, and a public benchmark shows
text and curves drawn faster than Canvas2D.
**Speaks to:** Figma, Chrome/Skia, Adobe and Apple Maps. This opens roles 1, 2, 4 and 5.

## 6. The daily output

One post a day, and it has to be small enough that it never steals the building time.

- **Daily: one finding.** One thing I measured or learned that day, with the number, a
  screenshot or a short clip, and the code. 150 to 300 words. 30 minutes at most.
- **Weekly: one real post.** A full explanation of one idea from the week, the kind someone
  would bookmark.
- **Per stage: a launch post.** What it does, how it works, what the numbers say. Posted to the
  three.js forum, the WebGPU community, X/Bluesky, and Hacker News when it is good enough.

The daily shader posts are also my portfolio for the creative roles (11–15). They keep that
fallback open without a separate project.

If a day's building produced no finding, the post says what I tried and why it failed. Failed
measurements are still content, and they are what makes the rest believable.

**Order of the day:** build first, write second. The post describes work that already
happened. Writing never replaces building.

## 7. Getting noticed by these companies

- **Measure their real demos.** When a target company has a public web viewer or demo, profile
  it with Chrome DevTools and the timing code from S1, and send the finding to that team.
- **Contribute upstream.** Small, real PRs to three.js (especially its WebGPU renderer) and to
  open-source splat viewers. Engineers at these companies read those repos.
- **Write to the engineer, not the recruiter.** When a stage speaks to a posting, send the link
  and one measured result to someone on that team.
- **Re-read the live posting before applying.** Section 4 came from a summary of each posting.
  Any bullet that isn't in section 4 gets added as a new row first.

## 8. If nobody hires me

The viewer SDK (S6) is itself a product: an embeddable viewer for splats and large scenes, with
honest performance numbers built in.

- The timing panel from S1 can grow into a paid profiler (hosted reports, CI checks that fail
  a build when a frame gets slower).
- The native core is the engine knowledge that makes either one credible.
- The blog and the PRs are the audience and the first customers.
- Before that, the same proof sells consulting: "I'll find why your scene is slow."

Signal that it is time to try: strangers are embedding the viewer every week without me asking
them to, or a company asks to pay for help.

## 9. Rules that keep the vector straight

1. One output at a time, one stage at a time. Finish a stage and ship it before the next.
2. Every new idea gets one question: does it make me better at building a fast browser
   renderer, or measure one honestly? If no, it goes in the parking lot below.
3. No number without a source. Never present a modeled number as measured.
4. Public by default. Unshipped work proves nothing.
5. Depth over breadth. I'd rather be the person known for one thing than fine at ten.
6. Review this file on the first of each month: update the status column in section 4, and
   check the postings again for new bullets.

### Parking lot

Ideas that are off the vector for now.

- **Shader cost profiler (old tool 2).** Per-line cost can't be measured honestly in a browser.
  The T29 finding is the evidence.
- **Three.js frame inspector (old tool 3).** Existing tools already cover most of it. The S1
  timing panel takes its place.
- **Effects kit (old tool 7):** particles, animation state machines, WebXR, the Gemini API.
  Pick it up only if a creative role becomes the target.
- **City tickets T26, T31 and T32.** Good ideas, but not needed for the city's "done when".
  Parked in the backlog on 2026-11-11. T28 and T30 were finished before the revision.

## 10. Scoreboard

Updated monthly.

| Date | Outputs shipped | Viewer stages shipped | Rows "have" in section 4 | Posts | Upstream PRs merged | Inbound contacts |
|---|---|---|---|---|---|---|
| 2026-11-11 | 0 of 3 | 0 of 6 | 6 of 33 | 0 | 0 | 0 |

## 11. Sources

Postings found by web search on 2026-11-11, covering roughly the previous six months. They are
examples, not a full survey, and some may be closed by now.

- [Adobe: Realtime Rendering and Graphics Engineer](https://www.talentify.io/job/realtime-rendering-and-graphics-engineer-san-francisco-california-adobe-r149279)
- [Figma: SWE Rendering & Animation](https://app.welcometothejungle.com/jobs/VLWo-bgC)
- [Apple: Sr SWE Front End Real-Time 3D](https://jobright.ai/jobs/info/6997e6dce0bddb6acac6c5a8)
- [Apple Maps: Sr Rendering Engine SWE](https://careers.swe.org/job/85351669/senior-rendering-engine-software-engineer/)
- [Google: Sr SWE Graphics, Fonts and Text Rendering](https://www.mediabistro.com/jobs/3539137361-senior-software-engineer-graphics-fonts-and-text-rendering)
- [Applied Intuition: Maps Rendering](https://jobs.ashbyhq.com/applied/88cd29c0-a142-4f7a-b9ea-be557bac9624)
- [Autodesk: Sr SWE Computer Graphics](https://careertools.binghamton.edu/jobs/autodesk-senior-software-engineer-computer-graphics/)
- [Matterport: Sr SDK Engineer 3D Web](https://www.mediabistro.com/jobs/3542222552-senior-sdk-engineer-3d-web-hybrid-remote-fridays)
- [Matterport: 3D Experiences](https://skillcore.nichesite.org/remote-jobs/remote-senior-software-engineer-3d-experiences-matterport)
- [Symbotic: Sr 3D Web Engineer](https://www.symbotic.com/careers/jobs/R7895/)
- [Avala.ai: WebGPU Graphics Engineer](https://avala.ai/careers/77ec2cf2-0525-48d8-9cc4-c719cf68d669)
- [Fanatics: Sr Creative Technologist](https://www.mediabistro.com/jobs/3540101422-senior-creative-technologist-job-at-fanatics-in-los-angeles)
- [Gemini: Creative Technologist](https://jobs.interactiveimmersive.io/job/creative-technologist-25/)
- [MATTE Projects: Creative Technologist](https://immersiveradar.com/jobs/a6eff16bea/)
- [Hovercraft: Creative Technologist](https://remoshift.com/job/creative-technologist-freelance-d821cf6e)
- [Spline: JS Developer, 3D Graphics](https://heyremote.io/job/NJ2vQtYOMh4tOjLtc3IL-Javascript-Developer-3D-Graphics--Spline)
