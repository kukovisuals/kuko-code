// Connects the real events to the map: the dev server's feed, and the program frame's messages.
import { PROGRAM_MESSAGE, type FeedEvent, type HardwareEvent, type HttpEvent, type ProgramEvent, type ProgramMessage } from '../../shared/liveEvents';
import type { DisplayLabel, HardwareMap, Recording } from '../../shared/types';
import { validateRecording } from '../../shared/validateRecording';
import { compileEffect, type LoadSample } from './compileEffect';
import { createHardwareView } from './hardwareView';
import { LiveRecorder, needsRedraw } from './liveRecorder';
import { createTraffic } from './traffic';
import { compileTrip, dotsForBytes, fetchTrip, firstDrawTrip, frameTrip, httpTrip, linkTrip, wifiTrip } from './trafficPlan';
import { fileReadRow, flowRow, httpRow, interfaceRow, programRow } from './wireRows';
import { createWireTable } from './wireTable';

// One dot for every 12th frame and one row for every 30th: at 60 Hz, every frame would be a blur.
export const FRAME_DOT_EVERY = 12;
export const FRAME_ROW_EVERY = 30;
const NET_ROW_EVERY = 4;
const REDRAW_CHECK_MS = 1000;
const LOAD_SAMPLES_KEPT = 40;
// Spaces out the burst of files at page load, so each one is seen as its own dot.
const HTTP_DOT_GAP_SEC = 0.09;

const OTHER_REQUEST = { color: '#c5d3e2', size: 0.75 };
const FEED_DOT = { color: '#6f8196', size: 0.5 };
const WIFI_DOT = { color: '#9fb0c2', size: 0.6 };
// Pale versions of the road colors with a dark rim, because a dot in the road's own color disappears on it.
const BUILD_DOT = { color: '#ffe0ae', size: 1.7 };
const FRAME_DOT = { color: '#d8f8ff', size: 1.5 };

// A display can only be told apart by its size. This is inferred: 3440 wide is the user's LG.
function currentDisplay(): DisplayLabel {
  return window.screen.width >= 2560 ? 'lg' : 'built-in';
}

export interface LiveHandlers {
  hardwareMap: HardwareMap;
  frame: HTMLIFrameElement;
  onRecording(recording: Recording): void;
  onErrors(errors: string[]): void;
  onStop(stop: number, metricId: string): void;
  onSelect(component: string): void;
  onGpu(percent: number | null): void;
  onFeedState(text: string): void;
  onProgramState(running: boolean, text: string): void;
}

export function createLiveMode(handlers: LiveHandlers) {
  const recorder = new LiveRecorder();
  const table = createWireTable(handlers.onSelect);
  const traffic = createTraffic(handlers.onStop);
  const hardware = createHardwareView((stats) => handlers.onGpu(stats?.devicePercent ?? null));

  let running = false;
  let drawn: Recording | null = null;
  let netSamples = 0;
  const httpWaiting: HttpEvent[] = [];
  let httpClock = 0;
  // The dev server's read time for each shader file, held until the program reports fetching that file.
  const readMsByFile = new Map<string, number>();
  // GPU process CPU samples, and the build they are compared against. See compileEffect.
  const gpuProcessSamples: LoadSample[] = [];
  let lastSampleAt: number | null = null;
  let build: { from: number | null; to: number | null; settled: boolean } = { from: null, to: null, settled: false };

  const judgeBuild = () => {
    if (build.from === null || build.to === null || build.settled) {
      return;
    }
    hardware.setCompileEffect(compileEffect(gpuProcessSamples, { from: build.from, to: build.to }));
    // Once a sample ends after the build did, no later sample can change the answer.
    build.settled = gpuProcessSamples.some((sample) => sample.to >= (build.to as number));
  };

  const publish = () => {
    if (!running) {
      return;
    }
    const recording = recorder.toRecording(handlers.hardwareMap, currentDisplay());
    if (!recording || !needsRedraw(drawn, recording)) {
      return;
    }
    const result = validateRecording(recording);
    if (!result.ok) {
      handlers.onErrors(result.errors);
      return;
    }
    drawn = recording;
    handlers.onRecording(result.value);
  };

  const onProgramEvent = (event: ProgramEvent) => {
    recorder.add(event);
    const isFrame = event.type === 'frame';
    if (!isFrame || event.frame % FRAME_ROW_EVERY === 0) {
      const row = programRow(event);
      if (row) {
        table.add(row);
      }
    }
    switch (event.type) {
      case 'fetch':
        traffic.enqueueBuild([{ steps: fetchTrip(event.ms, readMsByFile.get(event.file) ?? null), style: BUILD_DOT }]);
        readMsByFile.delete(event.file);
        break;
      case 'compile':
        build.from = event.at - event.compileMs;
        traffic.enqueueBuild([{ steps: compileTrip(event.compileMs), style: BUILD_DOT }]);
        break;
      case 'link':
        traffic.enqueueBuild([{ steps: linkTrip(event.linkMs), style: BUILD_DOT }]);
        break;
      case 'first-draw':
        traffic.enqueueBuild([{ steps: firstDrawTrip(event.ms), style: BUILD_DOT }]);
        handlers.onProgramState(true, 'Running: real GPU time on every frame');
        build.to = event.at;
        judgeBuild();
        publish();
        break;
      case 'frame':
        if (event.frame % FRAME_DOT_EVERY === 0 && !traffic.buildBusy) {
          traffic.spawn(frameTrip(event.callsMs, event.gpuMs, currentDisplay() === 'lg' ? 'lg' : 'built-in'), FRAME_DOT);
        }
        break;
      case 'error':
        handlers.onErrors([event.message]);
        handlers.onProgramState(false, 'The program failed. See the message above.');
        break;
      default:
        break;
    }
  };

  const onHardware = (event: HardwareEvent) => {
    const gpuProcessPercent = event.processes?.gpuProcessPercent ?? null;
    if (gpuProcessPercent !== null && lastSampleAt !== null) {
      gpuProcessSamples.push({ from: lastSampleAt, to: event.at, percent: gpuProcessPercent });
      if (gpuProcessSamples.length > LOAD_SAMPLES_KEPT && build.settled) {
        gpuProcessSamples.shift();
      }
    }
    lastSampleAt = event.at;
    judgeBuild();
    hardware.update(event);
    event.flows.forEach((flow) => {
      table.add(flowRow(flow, event.at));
      if (flow.isThisFeed) {
        traffic.spawn(httpTrip(), FEED_DOT);
      }
    });
    if (event.wifi) {
      const dots = dotsForBytes(event.wifi.inBytesPerSec + event.wifi.outBytesPerSec);
      for (let index = 0; index < dots; index += 1) {
        traffic.spawn(wifiTrip().map((step) => ({ ...step, durationSec: step.durationSec * (1 + index * 0.25) })), WIFI_DOT);
      }
    }
    netSamples += 1;
    if (netSamples % NET_ROW_EVERY === 0) {
      if (event.wifi) table.add(interfaceRow('Wi-Fi', event.wifi, event.at));
      if (event.loopback) table.add(interfaceRow('lo0', event.loopback, event.at));
    }
  };

  const onFeedEvent = (event: FeedEvent) => {
    if (event.type === 'hardware') {
      onHardware(event);
      return;
    }
    // The server resends recent requests so a page can see its own load. Earlier pages' requests aren't this page's.
    if (event.at < performance.timeOrigin) {
      return;
    }
    if (event.type === 'file-read') {
      table.add(fileReadRow(event));
      hardware.addFileRead(event);
      readMsByFile.set(event.file, event.ms);
      return;
    }
    table.add(httpRow(event));
    // Shader files get their dot from the program's own fetch event, which keeps the build trip in order.
    if (!event.path.endsWith('.glsl')) {
      httpWaiting.push(event);
    }
  };

  window.addEventListener('message', (event: MessageEvent<ProgramMessage>) => {
    if (event.origin === location.origin && event.source === handlers.frame.contentWindow && event.data?.channel === PROGRAM_MESSAGE) {
      onProgramEvent(event.data.event);
    }
  });

  const feed = new EventSource('/__live/events');
  feed.onopen = () => handlers.onFeedState('Live feed connected');
  feed.onerror = () => handlers.onFeedState('Live feed lost. It only exists under npm run dev. Retrying.');
  feed.onmessage = (message: MessageEvent<string>) => onFeedEvent(JSON.parse(message.data) as FeedEvent);

  window.setInterval(publish, REDRAW_CHECK_MS);

  return {
    trafficMesh: traffic.mesh,
    hardwareGroup: hardware.group,
    hardwareSections: hardware.sections,
    get running() {
      return running;
    },
    runProgram() {
      recorder.reset();
      traffic.clear();
      drawn = null;
      build = { from: null, to: null, settled: false };
      hardware.setCompileEffect(null);
      running = true;
      handlers.onProgramState(true, 'Starting: fetching and compiling');
      handlers.frame.src = `/program.html?run=${Date.now()}`;
    },
    stopProgram(text = 'Stopped. Its GPU work has ended, so watch the GPU reading fall.') {
      running = false;
      handlers.frame.src = 'about:blank';
      handlers.onProgramState(false, text);
    },
    update(deltaSec: number) {
      httpClock += deltaSec;
      while (httpWaiting.length > 0 && httpClock >= HTTP_DOT_GAP_SEC) {
        httpClock -= HTTP_DOT_GAP_SEC;
        httpWaiting.shift();
        traffic.spawn(httpTrip(), OTHER_REQUEST);
      }
      httpClock = Math.min(httpClock, HTTP_DOT_GAP_SEC);
      traffic.update(deltaSec);
    },
  };
}
