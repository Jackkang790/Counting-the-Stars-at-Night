import * as THREE from "three";
import type { BuildingConfig } from "./types";

/** Meter/Y-up/-Z-front stage. Render facade, light effects and depth-only masks are separate. */
export class MusicalStage {
  readonly root = new THREE.Group();
  readonly building = new THREE.Group();
  readonly occlusion = new THREE.Group();
  readonly effects = new THREE.Group();
  readonly anchors = new Map<string, THREE.Vector3>();
  private glow: THREE.MeshBasicMaterial;
  private doorGlow: THREE.MeshBasicMaterial;
  private panelGlow: THREE.MeshBasicMaterial;
  private wood: THREE.MeshStandardMaterial;
  private particleMaterial: THREE.PointsMaterial;
  private particles: THREE.Points;

  constructor(readonly config: BuildingConfig, panel: HTMLCanvasElement) {
    this.building.name = "PERFORMANCE_Facade"; this.occlusion.name = "OCCLUSION_Facade";
    this.effects.name = "FX_Facade";
    this.root.add(this.occlusion, this.building, this.effects);
    const wood = this.wood = new THREE.MeshStandardMaterial({ color: 0x553c2c, roughness: 0.9, emissive: 0xc98d42, emissiveIntensity: 0 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xe5ddc9, roughness: 1, side: THREE.DoubleSide });
    const panelTexture = new THREE.CanvasTexture(panel); panelTexture.colorSpace = THREE.SRGBColorSpace;
    const landscape = new THREE.MeshStandardMaterial({ map: panelTexture, side: THREE.DoubleSide, roughness: 1 });
    const depth = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent = this.building) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.name = name; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };
    // Approximate structures, deliberately no solid mask behind the actors.
    box("WALL_Paper", config.width, config.height, 0.03, 0, config.height / 2, 0.08, paper);
    const { door, panel: p } = config;
    const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.height), landscape);
    panelMesh.name = "PANEL_Landscape"; panelMesh.rotation.y = Math.PI;
    panelMesh.position.set(p.x, p.y, -0.015); this.building.add(panelMesh);
    box("DOOR_Paper", door.width, door.height, 0.035, door.x, door.y, -0.02, paper);
    for (let i = 0; i < 19; i++) box(`LATTICE_V_${i}`, 0.023, door.height, 0.035, door.x - door.width / 2 + i * door.width / 18, door.y, -0.06, wood);
    for (let i = 0; i < 13; i++) box(`LATTICE_H_${i}`, door.width, 0.023, 0.035, door.x, door.y - door.height / 2 + i * door.height / 12, -0.06, wood);
    for (const [i, x] of [-config.width / 2, -0.65, 1.9, config.width / 2].entries()) {
      box(`COLUMN_${i}`, 0.13, config.height, config.depth, x, config.height / 2, -0.06, wood);
      const mask = box(`MASK_Column_${i}`, 0.13, config.height, config.depth, x, config.height / 2, -0.06, depth, this.occlusion); mask.renderOrder = -10;
    }
    for (const [i, y] of [0.26, config.height - 0.05, 1.98].entries()) box(`FRAME_${i}`, config.width, 0.1, config.depth, 0, y, -0.05, wood);
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffd894, transparent: true, opacity: 0, depthWrite: false });
    this.doorGlow = new THREE.MeshBasicMaterial({ color: 0xffd49b, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i <= 4; i++) box(`LIGHT_Lattice_${i}`, 0.009, door.height, 0.002, door.x - door.width / 2 + i * door.width / 4, door.y, -0.075, this.doorGlow, this.effects);
    this.panelGlow = new THREE.MeshBasicMaterial({ color: 0xffce8b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.height), this.panelGlow);
    wash.name = "LIGHT_Landscape"; wash.position.set(p.x, p.y, -0.035); this.effects.add(wash);
    for (const [i, y] of [0.28, config.height].entries()) box(`LIGHT_H_${i}`, config.width, 0.016, 0.01, 0, y, -0.14, this.glow, this.effects);
    for (const [i, x] of [-config.width / 2, -0.65, 1.9, config.width / 2].entries()) box(`LIGHT_V_${i}`, 0.013, config.height, 0.01, x, config.height / 2, -0.14, this.glow, this.effects);
    const positions = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) { positions[i * 3] = Math.sin(i * 23.7) * config.width / 2; positions[i * 3 + 1] = (i / 80) * config.height; positions[i * 3 + 2] = -0.2; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particleMaterial = new THREE.PointsMaterial({ size: 0.012, color: 0xffdfa8, transparent: true, opacity: 0, depthWrite: false });
    this.particles = new THREE.Points(geometry, this.particleMaterial); this.effects.add(this.particles);
    this.anchors.set("door", new THREE.Vector3(door.x, door.y - door.height / 2, 0));
    this.anchors.set("panel", new THREE.Vector3(p.x, p.y - p.height / 2, 0));
    this.building.visible = false; this.occlusion.visible = false;
  }
  sample(time: number, light: number, particles: number): void {
    const end = time >= 30 ? 0 : Math.min(1, (30 - time) / 1.1);
    this.glow.opacity = end * light * (0.75 + Math.sin(time * 3.5) * 0.2);
    this.doorGlow.opacity = end * light * (0.11 + Math.sin(time * 2.4) * 0.025);
    this.panelGlow.opacity = end * light * 0.07;
    this.wood.emissiveIntensity = end * light * 0.15;
    this.particleMaterial.opacity = end * particles * 0.45;
    this.particles.position.y = (time * 0.06) % 0.3;
  }
  dispose(): void { disposeTree(this.root); }
}

export function disposeTree(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });
  materials.forEach(m => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); });
  textures.forEach(t => t.dispose()); geometries.forEach(g => g.dispose());
}
