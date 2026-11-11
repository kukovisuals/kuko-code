// City page wiring: holds the loaded recordings and keeps the scene in step with them.
// This page draws recorded data. It must never measure anything or import from src/record.
import hardwareMapJson from '../../data/hardware-map.m2.json';
import type { HardwareMap, Recording } from '../shared/types';
import { validateRecording } from '../shared/validateRecording';
import * as THREE from 'three';
import { buildBlocks } from './buildBlocks';
import { buildBoard } from './buildBoard';
import { buildGpuDistrict } from './buildGpuDistrict';
import { nameLabelFrom, note, numberRow, paintSelectedLabels } from './buildLabels';
import { buildRoads } from './buildRoads';
import { buildStops, type StopsView } from './buildStops';
import { disposeGroup } from './disposeGroup';
import { gpuFill } from './gpuFill';
import { createHud } from './hud';
import { compareRecordings, readRecordingFiles } from './loadRecording';
import { createNumbersPanel } from './numbersPanel';
import { pickComponent } from './picking';
import { buildPlaceholderRecording, isPlaceholderRecording } from './placeholderRecording';
import { planBuildings } from './planBuildings';
import { buildTimeline, sampleTimeline, type Timeline } from './replay';
import { createReplayToken } from './replayToken';
import { createLiveMode } from './live/liveMode';
import { LIVE_PROGRAM } from '../shared/liveProgram';
import { createStage } from './stage';
import { formatValue } from './stopRows';

const hardwareMap = hardwareMapJson as HardwareMap;
const stage = createStage(document.getElementById('city') as HTMLElement);

const blocks = buildBlocks(hardwareMap);
const roads = buildRoads();
const gpuDistrict = buildGpuDistrict(hardwareMap, blocks.cores);
const token = createReplayToken();
stage.scene.add(buildBoard(), blocks.group, roads.group, gpuDistrict.group, token.mesh);
gpuDistrict.setZoomVisible(false);

let recordings: Recording[] = [];
let activeIndex = 0;
let stopsView: StopsView | null = null;
let timeline: Timeline | null = null;
let replayClock = 0;
let zoomOpen = false;
let selected: string | null = null;
// Live draws the real program. File shows a saved recording or the invented preview instead.
let mode: 'live' | 'file' = 'live';

const panel = createNumbersPanel((id) => select(id, false));
panel.setGroup('displays', blocks.displaySections);
panel.setGroup('hardware', blocks.hardwareSections);
panel.setGroup('roads', [roads.section]);

const programFrame = document.getElementById('program-frame') as HTMLIFrameElement;
const live = createLiveMode({
  hardwareMap,
  frame: programFrame,
  onRecording(recording) {
    if (mode !== 'live') {
      return;
    }
    recordings = [recording];
    activeIndex = 0;
    // A rebuild would end a replay in progress, so it waits for the next change after that.
    if (!timeline) {
      render();
    }
  },
  onErrors: (errors) => hud.setErrors(errors),
  onStop(stop, metricId) {
    if (!timeline) {
      stopsView?.setActive(metricId, stop);
    }
  },
  onSelect: (component) => select(component, true),
  onGpu(percent) {
    if (mode === 'live') {
      gpuDistrict.setLivePercent(percent);
    }
  },
  onFeedState: (text) => hud.setFeedState(text),
  onProgramState(running, text) {
    hud.setProgramState(running, text);
  },
});
stage.scene.add(live.trafficMesh, live.hardwareGroup);
panel.setGroup('live', live.hardwareSections);

function select(id: string | null, reveal: boolean): void {
  selected = id;
  panel.setSelected(id, reveal);
  paintSelectedLabels(id);
}

stage.onClick((raycaster) => select(pickComponent(raycaster, stage.scene), true));
// Labels sit above the canvas, so they need their own click.
document.addEventListener('click', (event) => {
  const id = nameLabelFrom(event.target);
  if (id) {
    select(id, true);
  }
});

const hud = createHud({
  onFiles: (files) => {
    void loadFiles(files);
  },
  onPreview: showPreview,
  onSwap: () => {
    activeIndex = (activeIndex + 1) % recordings.length;
    render();
  },
  onReplay: toggleReplay,
  onZoom: toggleZoom,
  onToggleProgram: () => {
    if (live.running) {
      live.stopProgram();
    } else {
      startLive();
    }
  },
  onRestartProgram: startLive,
});

function startLive(): void {
  mode = 'live';
  blocks.setCoresChip('partial');
  hud.setErrors([]);
  recordings = [];
  render();
  live.runProgram();
}

function activeRecording(): Recording | null {
  return recordings[activeIndex] ?? null;
}

function stopReplay(): void {
  timeline = null;
  token.mesh.visible = false;
  stopsView?.setActive(null, null);
  hud.setReplayText(null);
}

// Both exits always show their speed limit. The recording's display gets its measured cadence beside it.
function updateExits(recording: Recording | null): void {
  const display = recording?.capture.display ?? null;
  const cadence = recording?.stops.find((stop) => stop.stop === 8)?.metrics.find((metric) => metric.id === 'frameDeltaMs');
  (['built-in', 'lg'] as const).forEach((id) => {
    const exit = blocks.exits[id];
    const active = id === display;
    exit.label.classList.toggle('exit-active', active);
    exit.body.classList.toggle('exit-active', active);
    exit.screen.material.emissiveIntensity = active ? 1.1 : 0.08;
    exit.body.querySelector('.exit-cadence')?.remove();
    if (active && cadence) {
      const holder = note('', 'exit-cadence');
      holder.textContent = 'This recording:';
      holder.append(
        numberRow({ name: cadence.id, value: cadence.value, unit: cadence.unit, tag: cadence.status, source: cadence.source }),
      );
      exit.body.append(holder);
    }
  });
  roads.setActiveExit(display === 'built-in' || display === 'lg' ? display : null);
}

function describe(recording: Recording): string {
  const { width, height } = recording.capture.drawingBuffer;
  const what = `${recording.shader.file} on ${recording.capture.display}, ${width} x ${height}, cache ${recording.capture.cacheState}`;
  return mode === 'live' ? `LIVE, with the city drawing too, so not recording quality. ${LIVE_PROGRAM.name} (${what})` : what;
}

function updateControls(): void {
  const next = recordings[(activeIndex + 1) % Math.max(recordings.length, 1)];
  hud.setControls({
    hasRecording: recordings.length > 0,
    canSwap: recordings.length > 1,
    swapLabel: recordings.length > 1 ? `Swap to ${next.capture.display}` : 'Swap display',
    replaying: timeline !== null,
    zoomOpen,
  });
}

function render(): void {
  stopReplay();
  if (stopsView) {
    disposeGroup(stopsView.group);
    stopsView = null;
  }
  const recording = activeRecording();
  hud.setBanner(recording !== null && isPlaceholderRecording(recording));
  hud.setWarnings(recordings.length > 1 ? compareRecordings(recordings[0], recordings[1]) : []);
  hud.setRecordingInfo(recording ? describe(recording) : mode === 'live' ? `LIVE: waiting for ${LIVE_PROGRAM.name} to report` : 'No recording loaded');
  updateExits(recording);
  // Live mode has the real reading, so the modeled fill only draws for a saved file.
  if (mode === 'file') {
    gpuDistrict.setFill(recording ? gpuFill(recording) : null);
  }
  if (recording) {
    stopsView = buildStops(planBuildings(recording), recording.imports, isPlaceholderRecording(recording));
    stage.scene.add(stopsView.group);
  }
  panel.setGroup('stops', [...(stopsView?.sections ?? []), ...(mode === 'file' ? [gpuDistrict.fillSection] : [])]);
  // Buildings and their labels were rebuilt, so the selection has to be painted again.
  select(selected, false);
  syncZoomScene();
  updateControls();
}

function show(list: Recording[]): void {
  mode = 'file';
  live.stopProgram('Stopped, because a file is on screen. Run it to go live again.');
  blocks.setCoresChip('fill modeled');
  recordings = list;
  activeIndex = 0;
  hud.setErrors([]);
  render();
}

function showPreview(): void {
  const results = [buildPlaceholderRecording('built-in'), buildPlaceholderRecording('lg')].map(validateRecording);
  const errors = results.flatMap((result) => (result.ok ? [] : result.errors));
  if (errors.length > 0) {
    show([]);
    hud.setErrors(errors);
    return;
  }
  show(results.flatMap((result) => (result.ok ? [result.value] : [])));
}

// An invalid file draws nothing and shows why.
async function loadFiles(files: File[]): Promise<void> {
  if (files.length === 0) {
    return;
  }
  const result = await readRecordingFiles(files);
  if (result.ok) {
    show(result.value);
  } else {
    show([]);
    hud.setErrors(result.errors);
  }
}

function toggleReplay(): void {
  const recording = activeRecording();
  if (timeline || !recording) {
    stopReplay();
  } else {
    timeline = buildTimeline(recording);
    replayClock = 0;
    token.mesh.visible = true;
  }
  updateControls();
}

function syncZoomScene(): void {
  gpuDistrict.setZoomVisible(zoomOpen);
  document.body.classList.toggle('zoom-open', zoomOpen);
  // The stop 7 view is about one core, so buildings and roads step aside.
  roads.group.visible = !zoomOpen;
  live.trafficMesh.visible = !zoomOpen;
  live.hardwareGroup.visible = !zoomOpen;
  if (stopsView) {
    stopsView.group.visible = !zoomOpen;
  }
}

function toggleZoom(): void {
  zoomOpen = !zoomOpen;
  syncZoomScene();
  if (zoomOpen) {
    const focus = gpuDistrict.zoomFocus;
    stage.flyTo(focus.clone().add(new THREE.Vector3(0, 12, 16)), focus.clone());
  } else {
    stage.flyHome();
  }
  updateControls();
}

function replayText(active: Timeline, sample: NonNullable<ReturnType<typeof sampleTimeline>>): string {
  const { step } = sample;
  const slowdown = step.trip === 'build' ? active.buildSlowdown : active.frameSlowdown;
  const trip = step.trip === 'build' ? 'Build trip' : 'Frame loop';
  const invented = isPlaceholderRecording(activeRecording() as Recording) ? ' INVENTED numbers.' : '';
  const place = step.metric
    ? `Stop ${step.stop}: ${step.metric.id} = ${formatValue(step.metric.value, step.metric.unit)} (${step.metric.status})`
    : (step.note ?? 'On the road: road time is not measured');
  return `SLOWED x${Math.round(slowdown)}. ${trip}. ${place}.${invented}`;
}

stage.onFrame((deltaSec) => {
  live.update(deltaSec);
  if (!timeline) {
    return;
  }
  replayClock += deltaSec;
  const sample = sampleTimeline(timeline, replayClock);
  if (!sample) {
    stopReplay();
    updateControls();
    return;
  }
  token.moveTo(sample.position, sample.step.trip);
  stopsView?.setActive(sample.step.metric?.id ?? null, sample.step.stop ?? null);
  hud.setReplayText(replayText(timeline, sample));
});

if (new URLSearchParams(window.location.search).has('preview')) {
  showPreview();
} else {
  startLive();
}
