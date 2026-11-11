// Eight named CPU core tiles, each with its own live load bar. The load is the whole Mac's, not this
// app's. No traffic dot ever lands on a tile, because nothing tells a page which core ran a thread.
import * as THREE from 'three';
import { nameLabel, numberRow, placeCard } from '../buildLabels';
import { layoutCpuCores, layoutMap, type Rect } from '../layoutMap';
import { BLOCK_HEIGHTS, COLORS } from '../palette';

const TILE_HEIGHT = 0.08;
const BAR_MAX_HEIGHT = 3.2;
const BAR_INSET = 0.45;

const CPU_SOURCE = 'Node os.cpus(), busy ticks since the last sample, whole Mac and every app. E is cpu0-3 and P is cpu4-7, checked on this M2 by running background-QoS work.';

interface Core {
  name: string;
  cpu: number;
  bar: THREE.Mesh;
  text: Text;
  percent: number;
}

function drawCluster(group: THREE.Group, clusterId: string, letter: 'P' | 'E', firstCpu: number, color: string): Core[] {
  const [area] = layoutMap([clusterId]) as unknown as [Rect];
  const top = BLOCK_HEIGHTS[clusterId] as number;
  const barMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.5 });
  const tileMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.22), roughness: 0.8 });
  const outline = new THREE.LineBasicMaterial({ color });

  return layoutCpuCores(area, 4).map((rect, index) => {
    const tileGeometry = new THREE.BoxGeometry(rect.w, TILE_HEIGHT, rect.d);
    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
    tile.position.set(rect.x + rect.w / 2, top + TILE_HEIGHT / 2, rect.z + rect.d / 2);
    tile.add(new THREE.LineSegments(new THREE.EdgesGeometry(tileGeometry), outline));

    const barGeometry = new THREE.BoxGeometry(rect.w - BAR_INSET * 2, 1, rect.d - BAR_INSET * 2);
    // The box grows upward from its base as it scales.
    barGeometry.translate(0, 0.5, 0);
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.position.set(tile.position.x, top + TILE_HEIGHT, tile.position.z);
    bar.scale.y = 0.001;

    const name = `${letter}${index + 1}`;
    const label = nameLabel(`${name} waiting`, 'live-hardware', 'block');
    label.classList.add('core-label');
    // Behind the tile, so the name stays clear of the roads and dots that pass in front of the cluster.
    const card = placeCard(label, new THREE.Vector3(tile.position.x, top, rect.z - 0.3), [0.5, 1]);
    group.add(tile, bar, card);
    return { name, cpu: firstCpu + index, bar, text: label.firstChild as Text, percent: 0 };
  });
}

export function createCoreTiles() {
  const group = new THREE.Group();
  const pCores = drawCluster(group, 'p-cluster', 'P', 4, COLORS.pCore);
  const eCores = drawCluster(group, 'e-cluster', 'E', 0, COLORS.eCore);

  const set = (cores: Core[], percents: number[]) =>
    cores.forEach((core, index) => {
      core.percent = Math.round(percents[index] ?? 0);
      core.bar.scale.y = Math.max((core.percent / 100) * BAR_MAX_HEIGHT, 0.001);
      core.text.textContent = `${core.name} ${core.percent}%`;
    });

  return {
    group,
    update(pPercents: number[], ePercents: number[]) {
      set(pCores, pPercents);
      set(eCores, ePercents);
    },
    rows(): HTMLElement[] {
      return [...pCores, ...eCores].map((core) =>
        numberRow({ name: `${core.name} core (cpu${core.cpu})`, value: core.percent, unit: '%', tag: 'partial', source: CPU_SOURCE }),
      );
    },
  };
}
