# Shader Pipeline City

Shows the path of one GLSL fragment shader on this Mac as a 3D city. The ground is a schematic
map of the M2 chip, the 8 pipeline stops sit on the hardware blocks where they run, roads are
handoffs, and building height is measured time. It records first, then replays, so the city's
own rendering doesn't distort the numbers.

## Source of truth

`docs/backlog.md` holds the board, tickets, schema, hardware numbers, sources and risks. Read
its section 1 before starting work, then the ticket and the reference sections it names. Don't
copy any of that into this file.

`docs/focus.md` holds the direction every ticket must point toward. Read its sections 1, 5
(Output 0) and 9 before picking up a ticket. Don't copy it here either.

## Keep every ticket on the focus

- This project is Output 0 in `docs/focus.md`. It is done when that section's "Done when" is
  met, and no sooner or later. Then work moves to the next output, not to more city features.
- Before starting a ticket, ask the rule 2 question from focus.md section 9. If the answer is
  no, say so, and offer to move the ticket to the parking lot instead of building it.
- Tickets that focus.md has parked are not worked on, even if the backlog still lists them as
  open. Point the user to the conflict and let them decide.
- In the plan, name what the ticket gives the next output (Output 0's "Gives the next output"
  line). If it gives nothing, say that.
- Prefer the approach that carries over to the next output: browser APIs and patterns that
  also exist in WebGPU over ones tied to WebGL2 or Three.js alone. Explain the carry-over in
  the Teach points.
- When a ticket is done, note any finding worth a daily post (focus.md section 6) in the
  backlog's findings, with its number and source.

## How to work

- Work one ticket at a time, and only that ticket. Anything else goes in the backlog's parking lot.
- Before writing code, explain the plan and the ticket's "Teach" points in plain language. The
  user is a frontend dev (JS, React, Node, GLSL, Three.js) who wants to understand every part.
- Check every "Done when" item and report the real result, including failures.
- Tick the board, add findings to the backlog, then stop and wait for the user.
- Commit only when the user asks.

## Constraints

- Vanilla Three.js + Vite + TypeScript. No React.
- Shaders come from local `./shaders/*.glsl` files only. No scraping Shadertoy.
- Only measure what a page can really measure.
- Native tools (Instruments, tshark) are out of scope for v0, but keep the JSON `imports[]` slot.
- **Never put device identifiers (serial, UUID, UDID) in code, logs or commits.**
- Small files, one job each. Code comments go on their own line above the code.
- Label every number with its source. Mark anything inferred as "modeled".
- Draw our own blocks. Don't copy or trace a die shot.
- This file stays under 200 lines.

## Measured, partial, modeled

Every stop and every metric is labeled with one of these. Never present a modeled number as
measured.

- **Measured:** a browser API reports this value directly.
- **Partial:** a real measurement, but it is a proxy or includes other work. Say what it includes.
- **Modeled:** calculated or inferred, with no measurement behind it.

## Honesty rules for the city

- A value can't render without a status and a source.
- Measured = solid. Partial = solid with a hatched band. Modeled = wireframe with a "modeled" tag.
- Stop 7 has no height of its own, so GPU time is never counted twice.
- Stop 8 has no time-based height: its compositor time is unknown.
- Heights use a log scale, with exact ms printed on every building.
- One-shot build values and per-frame values use different colors.
- The map is labeled schematic. The compositor's placement on the display engines is schematic too.

## Keep the recorder and the city apart

- `record.html` measures with raw WebGL2: no Three.js and nothing animating.
- `index.html` draws the city and never measures anything.
- `src/city` must not import from `src/record`.
- The city tab stays closed during recording.
- Native data sits beside browser numbers and never overwrites them.
