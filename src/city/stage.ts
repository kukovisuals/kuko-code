// Renderer, camera, lights and frame loop. Knows nothing about recordings.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { COLORS } from './palette';
import { isClick } from './picking';

const HOME_TARGET = new THREE.Vector3(0, 0, 1);
const HOME_OFFSET = new THREE.Vector3(0, 54, 38);
const FLY_SPEED = 3.5;
// The canvas shapes that fit the whole map and a flown-to view at their given distance.
const HOME_ASPECT = 1.75;
const FLY_ASPECT = 1.9;

export interface Stage {
  scene: THREE.Scene;
  // Calls back with the ray under the mouse for a click, but not for an orbit drag.
  onClick(callback: (raycaster: THREE.Raycaster) => void): void;
  onFrame(callback: (deltaSec: number) => void): void;
  flyTo(position: THREE.Vector3, target: THREE.Vector3): void;
  flyHome(): void;
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#c7d6ec', '#10151c', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-30, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  const range = 55;
  Object.assign(sun.shadow.camera, { left: -range, right: range, top: range, bottom: -range, far: 160 });
  scene.add(sun);
}

export function createStage(container: HTMLElement): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);
  addLights(scene);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'label-layer';
  container.appendChild(labels.domElement);

  const camera = new THREE.PerspectiveCamera(42, 1, 1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 12;
  controls.maxDistance = 190;

  // A narrower canvas needs a farther camera to fit the same view.
  const fitScale = (fitsAspect: number) => {
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    return Math.max(1, fitsAspect / aspect);
  };
  const homePosition = () => HOME_TARGET.clone().add(HOME_OFFSET.clone().multiplyScalar(fitScale(HOME_ASPECT)));

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    renderer.setSize(width, height);
    labels.setSize(width, height);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  // The container changes size when the left panel opens, not only when the window does.
  new ResizeObserver(resize).observe(container);
  resize();
  camera.position.copy(homePosition());
  controls.target.copy(HOME_TARGET);

  let flight: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  renderer.domElement.addEventListener('pointerdown', () => {
    flight = null;
  });

  const clickCallbacks: Array<(raycaster: THREE.Raycaster) => void> = [];
  const raycaster = new THREE.Raycaster();
  let pressedAt = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pressedAt = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!isClick(pressedAt, { x: event.clientX, y: event.clientY })) {
      return;
    }
    const box = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    clickCallbacks.forEach((callback) => callback(raycaster));
  });

  const callbacks: Array<(deltaSec: number) => void> = [];
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((timestamp) => {
    timer.update(timestamp);
    const deltaSec = timer.getDelta();
    callbacks.forEach((callback) => callback(deltaSec));
    if (flight) {
      const blend = 1 - Math.exp(-FLY_SPEED * deltaSec);
      camera.position.lerp(flight.position, blend);
      controls.target.lerp(flight.target, blend);
      if (camera.position.distanceTo(flight.position) < 0.05) {
        flight = null;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  return {
    scene,
    onClick: (callback) => clickCallbacks.push(callback),
    onFrame: (callback) => callbacks.push(callback),
    flyTo: (position, target) => {
      const offset = position.clone().sub(target).multiplyScalar(fitScale(FLY_ASPECT));
      flight = { position: target.clone().add(offset), target };
    },
    flyHome: () => {
      flight = { position: homePosition(), target: HOME_TARGET.clone() };
    },
  };
}
