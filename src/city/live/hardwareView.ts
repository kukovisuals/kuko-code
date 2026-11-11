// Real load on the map: the CPU core tiles, the processes, and the reading beside the GPU, plus panel
// sections with every number and its source. All of it is the whole Mac, and the labels say so.
import * as THREE from 'three';
import type { FileReadEvent, GpuStats, HardwareEvent } from '../../shared/liveEvents';
import { nameLabel, note, numberRow, placeCard, rowsBox } from '../buildLabels';
import { layoutMap, type Rect } from '../layoutMap';
import type { GpuFill } from '../gpuFill';
import type { PanelSection } from '../numbersPanel';
import type { CompileEffect } from './compileEffect';
import { createCoreTiles } from './coreTiles';
import { createProcessView } from './processView';
import { createSpareRoomView } from './spareRoomView';

const GPU_SOURCE = 'ioreg IOAccelerator PerformanceStatistics, whole GPU and every app using it. macOS gives one number for all 10 cores, so per-core use is unknown.';
const NET_SOURCE = 'netstat -ib interface counters, whole Mac.';
const READ_SOURCE = "performance.now() around fs.readFile in the dev server: open, read and close. macOS may answer from its file cache in memory, so this doesn't prove the SSD was touched.";

export function createHardwareView(onGpu: (stats: GpuStats | null) => void) {
  const [coreArea] = layoutMap(['gpu-core']) as unknown as [Rect];
  const group = new THREE.Group();
  const cores = createCoreTiles();
  const processes = createProcessView();
  const spare = createSpareRoomView();
  group.add(cores.group, processes.group, spare.group);

  const gpuLabel = nameLabel('GPU waiting', 'live-hardware', 'block', 'partial');
  gpuLabel.classList.add('live-reading');
  const gpuText = gpuLabel.firstChild as Text;
  group.add(placeCard(gpuLabel, new THREE.Vector3(coreArea.x + coreArea.w, 0.5, coreArea.z - 0.1), [1, 1]));

  const body = rowsBox();
  body.append(note('Waiting for the first reading from the dev server.'));
  const section: PanelSection = { id: 'live-hardware', title: 'Live readings, whole Mac', body, open: true };
  // The latest read of each shader file, kept until the next sample redraws the rows.
  const fileReads = new Map<string, FileReadEvent>();
  let effect: CompileEffect | null = null;

  const number = (name: string, value: number, unit: string, source: string) =>
    numberRow({ name, value, unit, tag: 'partial', source });

  return {
    group,
    sections: [spare.section, section, processes.section],
    addFileRead(event: FileReadEvent) {
      fileReads.set(event.file, event);
    },
    setCompileEffect(next: CompileEffect | null) {
      effect = next;
    },
    // Whether the program runs, and stop 6's GPU time against the frame budget, for the bottleneck verdict.
    setProgram(running: boolean, fill: GpuFill | null) {
      spare.setProgram(running, fill);
    },
    update(event: HardwareEvent) {
      cores.update(event.pCorePercents, event.eCorePercents);
      processes.update(event.processes, effect);
      spare.update(event);
      gpuText.textContent = event.gpu ? `GPU ${event.gpu.devicePercent}%` : 'GPU no reading';
      onGpu(event.gpu);

      const rows = cores.rows();
      if (event.gpu) {
        rows.push(
          number('GPU device', event.gpu.devicePercent, '%', GPU_SOURCE),
          number('GPU renderer', event.gpu.rendererPercent, '%', GPU_SOURCE),
          number('GPU tiler', event.gpu.tilerPercent, '%', GPU_SOURCE),
          number('GPU memory in use', Math.round(event.gpu.inUseMemoryBytes / (1024 * 1024)), 'MB', GPU_SOURCE),
        );
      }
      const netRow = (name: string, rate: HardwareEvent['wifi']) =>
        rate ? [number(name, Math.round((rate.inBytesPerSec + rate.outBytesPerSec) / 1024), 'KB/s', NET_SOURCE)] : [];
      const readRows = [...fileReads.values()].map((read) =>
        number(`Read ${read.file.replace('shaders/', '')}, ${read.bytes.toLocaleString('en-US')} bytes`, read.ms, 'ms', READ_SOURCE),
      );
      body.replaceChildren(
        ...rows,
        ...netRow('Loopback', event.loopback),
        ...netRow('Wi-Fi', event.wifi),
        ...readRows,
        note('Neural Engine, media engine and memory ring stay dark: no reading is available without root.'),
      );
    },
  };
}
