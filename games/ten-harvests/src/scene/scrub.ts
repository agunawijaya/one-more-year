/**
 * Scrub on the wild plain: low tamarisk and camel-thorn bushes, so the
 * land beyond the fields reads as living floodplain rather than bare sand.
 */
import { Color, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { CityLayout } from './layout.ts';
import type { ScenePalette } from './palette.ts';

export interface Scrub {
  mesh: InstancedMesh;
  setPalette(palette: ScenePalette): void;
}

export function createScrub(layout: CityLayout, palette: ScenePalette): Scrub {
  const geometry = new IcosahedronGeometry(0.9, 0);
  geometry.scale(1.25, 0.45, 1);
  geometry.translate(0, 0.22, 0);
  const material = new MeshStandardMaterial({ roughness: 1, flatShading: true });
  const mesh = new InstancedMesh(geometry, material, layout.scrub.length);
  const dummy = new Object3D();
  layout.scrub.forEach((bush, i) => {
    dummy.position.set(bush.x, 0, bush.z);
    dummy.rotation.set(0, bush.turn, 0);
    dummy.scale.set(bush.scale, bush.scale * (0.7 + (i % 5) * 0.12), bush.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'scrub';

  function paint(next: ScenePalette): void {
    const dry = next.sand.clone().lerp(next.silt, 0.6);
    const tone = new Color();
    layout.scrub.forEach((_, i) => {
      // A spread of greys and greens from dusty olive to dry thorn.
      tone.copy(next.grass).lerp(dry, 0.25 + ((i * 7919) % 100) / 180);
      tone.multiplyScalar(0.85 + ((i * 104729) % 50) / 180);
      mesh.setColorAt(i, tone);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  paint(palette);
  return { mesh, setPalette: paint };
}
