// Real load on the map: one bar per CPU core and the reading beside each block, plus a panel section with
// every number and its source. All of it is the whole Mac, and the labels say so.
import * as THREE from 'three';
import type { GpuStats, HardwareEvent } from '../../shared/liveEvents';
import { nameLabel, note, numberRow, placeCard, rowsBox } from '../buildLabels';
import { layoutMap, type Rect } from '../layoutMap';
import type { PanelSection } from '../numbersPanel';
import { COLORS } from '../palette';

const BAR_BASE_Y = 0.35;
const BAR_MAX_HEIGHT = 3.2;
const BAR_GAP = 0.5;

const CPU_SOURCE = "Node os.cpus(), busy ticks since the last sample, whole Mac. E is cpu0-3 and P is cpu4-7, checked on this M2 by running background-QoS work.";
const GPU_SOURCE = 'ioreg IOAccelerator PerformanceStatistics, whole GPU and every app using it. macOS gives one number for all 10 cores, so per-core use is unknown.';
const NET_SOURCE = 'netstat -ib interface counters, whole Mac.';

const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);

function coreBars(area: Rect, count: number, color: string) {
  const group = new THREE.Group();
  const width = (area.w - BAR_GAP * (count + 1)) / count;
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.5 });
  const bars = Array.from({ length: count }, (_, index) => {
    const geometry = new THREE.BoxGeometry(width, 1, area.d - 1);
    // The box grows upward from its base as it scales.
    geometry.translate(0, 0.5, 0);
    const bar = new THREE.Mesh(geometry, material);
    bar.position.set(area.x + BAR_GAP + index * (width + BAR_GAP) + width / 2, BAR_BASE_Y, area.z + area.d / 2);
    bar.scale.y = 0.001;
    group.add(bar);
    return bar;
  });
  return { group, bars };
}

function readout(text: string, component: string, position: THREE.Vector3) {
  const node = nameLabel(text, component, 'block', 'partial');
  node.classList.add('live-reading');
  const textNode = node.firstChild as Text;
  return { object: placeCard(node, position, [1, 1]), setText: (value: string) => (textNode.textContent = value) };
}

export function createHardwareView(onGpu: (stats: GpuStats | null) => void) {
  const [pArea, eArea, coreArea] = layoutMap(['p-cluster', 'e-cluster', 'gpu-core']) as unknown as [Rect, Rect, Rect];
  const group = new THREE.Group();
  const pBars = coreBars(pArea, 4, COLORS.pCore);
  const eBars = coreBars(eArea, 4, COLORS.eCore);
  group.add(pBars.group, eBars.group);

  const pReading = readout('P waiting', 'live-hardware', new THREE.Vector3(pArea.x + pArea.w, 0.5, pArea.z - 0.1));
  const eReading = readout('E waiting', 'live-hardware', new THREE.Vector3(eArea.x + eArea.w, 0.5, eArea.z - 0.1));
  const gpuReading = readout('GPU waiting', 'live-hardware', new THREE.Vector3(coreArea.x + coreArea.w, 0.5, coreArea.z - 0.1));
  group.add(pReading.object, eReading.object, gpuReading.object);

  const body = rowsBox();
  body.append(note('Waiting for the first reading from the dev server.'));
  const section: PanelSection = { id: 'live-hardware', title: 'Live readings, whole Mac', body, open: true };

  const number = (name: string, value: number, unit: string, source: string) =>
    numberRow({ name, value, unit, tag: 'partial', source });

  return {
    group,
    section,
    update(event: HardwareEvent) {
      const setBars = (bars: THREE.Mesh[], percents: number[]) =>
        bars.forEach((bar, index) => {
          bar.scale.y = Math.max(((percents[index] ?? 0) / 100) * BAR_MAX_HEIGHT, 0.001);
        });
      setBars(pBars.bars, event.pCorePercents);
      setBars(eBars.bars, event.eCorePercents);
      pReading.setText(`P ${Math.round(average(event.pCorePercents))}%`);
      eReading.setText(`E ${Math.round(average(event.eCorePercents))}%`);
      gpuReading.setText(event.gpu ? `GPU ${event.gpu.devicePercent}%` : 'GPU no reading');
      onGpu(event.gpu);

      const rows = [
        ...event.pCorePercents.map((percent, index) => number(`P core ${index + 1}`, Math.round(percent), '%', CPU_SOURCE)),
        ...event.eCorePercents.map((percent, index) => number(`E core ${index + 1}`, Math.round(percent), '%', CPU_SOURCE)),
      ];
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
      body.replaceChildren(
        ...rows,
        ...netRow('Loopback', event.loopback),
        ...netRow('Wi-Fi', event.wifi),
        note('Neural Engine, media engine and memory ring stay dark: no reading is available without root.'),
      );
    },
  };
}
