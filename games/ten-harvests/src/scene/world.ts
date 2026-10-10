/**
 * The city on the river, assembled: sky, land, water, fields and wheat,
 * houses and temple, granary, palms and people, with the lights of the
 * current appearance.
 *
 * `show()` takes the numbers the player sees (people, grain, acres, the
 * acres planted, the season of the fields and the year's yield) and makes
 * the picture agree with them: one parcel per ten acres, one lit window per
 * ten people after dark, the granary filled to the store.
 */
import { AmbientLight, DirectionalLight, Fog, HemisphereLight, Scene } from 'three';
import { createCity, type City } from './city.ts';
import {
  createFieldState,
  createParcelGround,
  HIGHLIGHT,
  OWNERSHIP,
  UNKNOWN_QUALITY,
  type FieldState,
  type ParcelGround,
} from './fields.ts';
import { createFigures, type Figures } from './figures.ts';
import { createGranary, type Granary } from './granary.ts';
import { cityLayout, parcelsForAcres, type CityLayout, type Parcel } from './layout.ts';
import { createPalms, type Palms } from './palms.ts';
import {
  createFrontierMarker,
  createParcelPicker,
  type FrontierMarker,
  type ParcelPicker,
} from './picking.ts';
import { paletteFor, type ScenePalette } from './palette.ts';
import { createLamps } from './lamps.ts';
import { createScrub } from './scrub.ts';
import { createSky } from './sky.ts';
import { createTerrain, type Terrain } from './terrain.ts';
import { applyPalette, createSharedUniforms, type SharedUniforms } from './uniforms.ts';
import { createWater, type Water } from './water.ts';
import { createWheat, type Wheat } from './wheat.ts';
import type { Appearance } from '@one-more-year/kit';

export interface CityValues {
  people: number;
  grain: number;
  acres: number;
  /** Acres sown (or planned to be sown). */
  planted: number;
  /** 0 bare earth, 0–1 growing, 1 ripe, 1–2 being cut. */
  season: number;
  /** The year's yield per acre, or null while it is not known. */
  yieldPerAcre: number | null;
  /** Acres being bought (+) or sold (−) in the plan: those parcels are highlighted. */
  landChange?: number;
  /** Grain on its way out of the granary in the plan, by use, for the sacks by the door. */
  sacks?: { food: number; seed: number; land: number };
  /**
   * The parcels chosen for sowing, when the player has painted them; by
   * default the nearest owned parcels are sown.
   */
  plantedSlots?: ReadonlySet<number>;
  /** Shows the handle on the edge of the fields (the plan screen). */
  showFrontier?: boolean;
}

export interface CityWorld {
  readonly scene: Scene;
  readonly layout: CityLayout;
  readonly uniforms: SharedUniforms;
  readonly fields: FieldState;
  readonly granary: Granary;
  readonly city: City;
  readonly figures: Figures;
  readonly water: Water;
  readonly wheat: Wheat;
  readonly sun: DirectionalLight;
  readonly palette: ScenePalette;
  readonly values: CityValues;
  readonly picker: ParcelPicker;
  readonly frontier: FrontierMarker;
  /** How many parcels the city owns in the picture now. */
  readonly ownedParcels: number;
  show(values: CityValues): void;
  /** Lays the season of one parcel by hand (the cinematic's harvest sweep). */
  setParcelSeason(slot: number, season: number): void;
  setAppearance(appearance: Appearance): void;
  setWheatDensity(perParcel: number): void;
  /**
   * For the Hall's drawn styles: leaves out what would turn into a thicket of
   * lines (wheat blades, palm fronds, scrub, walkers, lamp glows), so the
   * fields read as flat parcels and the city as clean shapes.
   */
  setSketch(sketch: boolean): void;
  setShadows(size: number): void;
  update(seconds: number, time: number): void;
  owned(): Parcel[];
  planted(): Parcel[];
}

/** Parcels at the field's edge offered for sale: at least a dozen, or a sixth of the holding. */
export function parcelsOnOffer(owned: number): number {
  return Math.max(12, Math.round(owned / 6));
}

export function createCityWorld(appearance: Appearance): CityWorld {
  const layout = cityLayout();
  let palette = paletteFor(appearance);
  const scene = new Scene();
  const uniforms = createSharedUniforms();
  applyPalette(uniforms, palette);
  scene.fog = new Fog(palette.fog, palette.fogNear, palette.fogFar);

  const sky = createSky(uniforms);
  scene.add(sky);
  const terrain: Terrain = createTerrain(layout.roads, palette);
  scene.add(terrain.group);
  const fields = createFieldState(layout.parcels.length);
  const water = createWater(uniforms, layout, fields.texture, palette);
  scene.add(water.group);

  const parcels: ParcelGround = createParcelGround(layout.parcels, fields, uniforms.uTime, palette);
  scene.add(parcels.mesh);
  const wheat = createWheat(layout.parcels, fields.texture, uniforms, palette);
  scene.add(wheat.mesh);

  const city = createCity(layout, palette);
  scene.add(city.group);
  const lamps = createLamps(layout.windows, city.fires, layout.cityCentre, uniforms, palette);
  lamps.setPalette(palette);
  scene.add(lamps.group);
  const granary = createGranary(layout, palette);
  scene.add(granary.group);
  const palms: Palms = createPalms(layout, uniforms, palette);
  scene.add(palms.mesh);
  const scrub = createScrub(layout, palette);
  scene.add(scrub.mesh);
  const figures = createFigures(layout, palette);
  scene.add(figures.group);
  const picker = createParcelPicker(layout.parcels);
  const frontier = createFrontierMarker();
  scene.add(frontier.group);

  const hemi = new HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
  scene.add(hemi);
  const ambient = new AmbientLight('#ffffff', 0.05);
  scene.add(ambient);
  const sun = new DirectionalLight(palette.keyColor, palette.keyIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -95;
  shadowCamera.right = 95;
  shadowCamera.top = 70;
  shadowCamera.bottom = -70;
  shadowCamera.near = 1;
  shadowCamera.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  let perParcel = 600;
  let builtFor = 0;
  let values: CityValues = {
    people: 0,
    grain: 0,
    acres: 0,
    planted: 0,
    season: 1,
    yieldPerAcre: null,
  };
  let ownedCount = 0;
  let plantedCount = 0;

  function placeSun(): void {
    const focus = { x: -5, z: 10 };
    sun.position.set(
      focus.x + palette.keyDirection.x * 220,
      palette.keyDirection.y * 220,
      focus.z + palette.keyDirection.z * 220,
    );
    sun.target.position.set(focus.x, 0, focus.z);
    sun.color.copy(palette.keyColor);
    sun.intensity = palette.keyIntensity;
  }
  placeSun();

  function ensureWheat(): void {
    // Blades are laid on owned parcels; rebuild only when the holding outgrows what was laid.
    const needed = Math.ceil(Math.max(ownedCount, 1) / 32) * 32;
    if (needed === builtFor) return;
    builtFor = needed;
    wheat.rebuild(needed, perParcel);
  }

  function show(next: CityValues): void {
    values = next;
    const total = layout.parcels.length;
    ownedCount = parcelsForAcres(next.acres, total);
    plantedCount = Math.min(ownedCount, parcelsForAcres(next.planted, total));
    const onOffer = Math.min(total, ownedCount + parcelsOnOffer(ownedCount));
    const quality = next.yieldPerAcre === null ? UNKNOWN_QUALITY : next.yieldPerAcre / 6;
    const before = parcelsForAcres(next.acres - (next.landChange ?? 0), total);
    for (let slot = 0; slot < total; slot++) {
      const ownership =
        slot < ownedCount ? OWNERSHIP.owned : slot < onOffer ? OWNERSHIP.forSale : OWNERSHIP.none;
      fields.set(slot, ownership, slot < plantedCount ? 1 : 0, next.season, quality);
      const buying = slot >= before && slot < ownedCount;
      const selling = slot >= ownedCount && slot < before;
      fields.setHighlight(slot, buying ? HIGHLIGHT.buy : selling ? HIGHLIGHT.sell : HIGHLIGHT.none);
    }
    fields.commit();
    granary.setSacks('food', next.sacks?.food ?? 0);
    granary.setSacks('seed', next.sacks?.seed ?? 0);
    granary.setSacks('land', next.sacks?.land ?? 0);
    ensureWheat();
    city.setPeople(next.people);
    lamps.setLitWindows(city.litSlots());
    figures.setPeople(next.people, layout.parcels.slice(0, plantedCount));
    granary.setStore(next.grain);
    const edge = ownedCount > 0 ? (layout.parcels[ownedCount - 1] ?? null) : null;
    frontier.placeAt(next.showFrontier ? edge : null, layout.granary);
  }

  return {
    scene,
    layout,
    uniforms,
    fields,
    granary,
    city,
    figures,
    water,
    wheat,
    sun,
    get palette() {
      return palette;
    },
    get values() {
      return values;
    },
    picker,
    frontier,
    get ownedParcels() {
      return ownedCount;
    },
    show,
    setParcelSeason(slot, season) {
      fields.setSeason(slot, season);
    },
    setAppearance(next) {
      palette = paletteFor(next);
      applyPalette(uniforms, palette);
      (scene.fog as Fog).color.copy(palette.fog);
      (scene.fog as Fog).near = palette.fogNear;
      (scene.fog as Fog).far = palette.fogFar;
      hemi.color.copy(palette.hemiSky);
      hemi.groundColor.copy(palette.hemiGround);
      hemi.intensity = palette.hemiIntensity;
      placeSun();
      terrain.setPalette(palette);
      water.setPalette(palette);
      parcels.setPalette(palette);
      wheat.setPalette(palette);
      city.setPalette(palette);
      lamps.setPalette(palette);
      lamps.setLitWindows(city.litSlots());
      granary.setPalette(palette);
      palms.setPalette(palette);
      scrub.setPalette(palette);
      figures.setPalette(palette);
    },
    setSketch(sketch) {
      wheat.mesh.visible = !sketch;
      palms.mesh.visible = !sketch;
      scrub.mesh.visible = !sketch;
      figures.group.visible = !sketch;
      lamps.group.visible = !sketch;
      frontier.group.visible = !sketch;
    },
    setWheatDensity(next) {
      if (next === perParcel) return;
      perParcel = next;
      builtFor = 0;
      ensureWheat();
    },
    setShadows(size) {
      sun.castShadow = size > 0;
      if (size > 0 && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    update(seconds, time) {
      uniforms.uTime.value = time;
      fields.commit();
      granary.update(seconds);
      figures.update(time);
      frontier.update(time);
    },
    owned: () => layout.parcels.slice(0, ownedCount),
    planted: () => layout.parcels.slice(0, plantedCount),
  };
}
