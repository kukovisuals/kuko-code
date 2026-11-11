// The three processes on the CPU district: a zone on the floor around the stops each one runs, and
// how much CPU time it used. A real reading per process. Which core ran it is not known, and not drawn.
import * as THREE from 'three';
import type { ProcessLoads } from '../../shared/liveEvents';
import { claimRow, nameLabel, note, numberRow, placeCard, rowsBox } from '../buildLabels';
import type { PanelSection } from '../numbersPanel';
import { BLOCK_HEIGHTS, COLORS } from '../palette';
import { PROCESS_ZONES, type ProcessId } from '../processZones';
import type { CompileEffect } from './compileEffect';

export const PROCESS_SECTION = 'live-processes';
const SHARE = 'as a share of one core, so 100% is one core busy for the whole sample';
const NODE_SOURCE = `Node process.cpuUsage(): CPU time this dev server process used since the last sample, ${SHARE}. Includes serving the city page and taking these readings.`;
const PS_SOURCE = `ps CPU time, no root: change since the last sample, ${SHARE}. Only the process type is read from ps, never its command line.`;
const GPU_PROCESS_SOURCE = `${PS_SOURCE} All Chrome tabs share this one process, and the city's own drawing runs in it too.`;
const RENDERER_SOURCE = `${PS_SOURCE} ps can't say which renderer is this tab, so this covers every Chrome tab.`;
const PLACEMENT_SOURCE = "Chromium GPU architecture docs: a sandboxed renderer runs the page's JS and sends WebGL calls to one GPU process, where ANGLE and Metal run. Apple's Metal may hand compiling to a helper process, which isn't read here";
const EFFECT_SOURCE = 'Compares GPU process CPU samples from before the build with those overlapping it. The build runs from the compile call to the first draw, timed by the program page.';

function drawZone(group: THREE.Group, id: ProcessId) {
  const zone = PROCESS_ZONES.find((entry) => entry.id === id) as (typeof PROCESS_ZONES)[number];
  const { rect } = zone;
  const y = (BLOCK_HEIGHTS.cpu as number) + 0.015;
  const geometry = new THREE.PlaneGeometry(rect.w, rect.d);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: COLORS.process, transparent: true, opacity: 0.06, depthWrite: false });
  const floor = new THREE.Mesh(geometry, material);
  floor.position.set(rect.x + rect.w / 2, y, rect.z + rect.d / 2);
  floor.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: COLORS.process })));

  const label = nameLabel(`${zone.name} waiting`, PROCESS_SECTION, 'block', 'partial');
  label.classList.add('live-reading');
  // On the zone's front edge, where no tower's own label sits.
  group.add(floor, placeCard(label, new THREE.Vector3(rect.x + 0.3, y, rect.z + rect.d - 0.3), [0, 1]));
  const text = label.firstChild as Text;
  return (reading: string, percent: number | null) => {
    text.textContent = reading;
    // A busier process gets a brighter floor. The floor's size means nothing.
    material.opacity = 0.06 + (Math.min(percent ?? 0, 100) / 100) * 0.34;
  };
}

export function createProcessView() {
  const group = new THREE.Group();
  const setRenderer = drawZone(group, 'renderer');
  const setNode = drawZone(group, 'node');
  const setGpuProcess = drawZone(group, 'gpu-process');

  const body = rowsBox();
  body.append(note('Waiting for the first reading from the dev server.'));
  const section: PanelSection = { id: PROCESS_SECTION, title: 'Processes on the CPU', body, open: true };
  const percentRow = (name: string, value: number, source: string) => numberRow({ name, value: Math.round(value), unit: '%', tag: 'partial', source });

  return {
    group,
    section,
    update(loads: ProcessLoads | null, effect: CompileEffect | null) {
      if (!loads) {
        return;
      }
      const gpu = loads.gpuProcessPercent;
      setRenderer(`Chrome renderers ${Math.round(loads.renderersPercent)}%`, loads.renderersPercent);
      setNode(`Node ${Math.round(loads.nodePercent)}%`, loads.nodePercent);
      setGpuProcess(gpu === null ? 'Chrome GPU process: no reading' : `Chrome GPU process ${Math.round(gpu)}%`, gpu);

      body.replaceChildren(
        percentRow('Node (dev server)', loads.nodePercent, NODE_SOURCE),
        percentRow(`Chrome renderers, all ${loads.rendererCount}`, loads.renderersPercent, RENDERER_SOURCE),
        percentRow('Busiest renderer', loads.busiestRendererPercent, RENDERER_SOURCE),
        ...(gpu === null ? [note('ps shows no Chrome GPU process.')] : [percentRow('Chrome GPU process', gpu, GPU_PROCESS_SOURCE)]),
        claimRow(effect?.text ?? 'Build vs GPU process CPU: waiting for the program to build its shader', 'partial', EFFECT_SOURCE),
        claimRow('Stops 2 and 3 run in a renderer. Stops 4 and 5 run in the GPU process', 'published', PLACEMENT_SOURCE),
        note("A process is not a core. macOS moves each thread between cores many times a second, and doesn't tell a page or ps which core ran it. So these readings sit on the district, and no dot ever lands on a core tile."),
      );
    },
  };
}
