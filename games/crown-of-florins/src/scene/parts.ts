/**
 * A small kit of parts for building the city in code: boxes, gable and hip
 * roofs, prisms, domes, cones and rows of battlements, appended to one
 * growing geometry.
 *
 * Every vertex carries what the fresco shader needs to paint it: a pigment
 * (colour), a surface kind (plain, a façade with windows, roof tiles,
 * striped marble, an awning, a dome's ribs…), façade coordinates in world
 * units (so windows and tiles keep their size on any wall) and an object id
 * (so the contour pass draws a line where two houses meet even when their
 * walls face the same way).
 */
import type { Color } from 'three';
import { BufferAttribute, BufferGeometry } from 'three';

export const SURFACE = {
  plain: 0,
  facade: 1,
  roof: 2,
  marble: 3,
  awning: 4,
  dome: 5,
  stone: 6,
  window: 7,
  wood: 8,
  gilt: 9,
  banner: 10,
  scaffold: 11,
  skin: 12,
  flame: 13,
  rose: 14,
  paving: 15,
  /** A town house's roof: tiles like any roof; at a coronation some keep their vermilion. */
  houseRoof: 16,
  /** A cottage's roof outside the walls: tiles, never gilded. */
  cottageRoof: 17,
} as const;

export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class PartsBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private facade: number[] = [];
  private kinds: number[] = [];
  private ids: number[] = [];
  private currentId = 1;

  /** Starts a new object: its faces get their own contour id. */
  object(id?: number): this {
    this.currentId = id ?? this.currentId + 1;
    return this;
  }

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** One flat quad: corners in order around the face; façade (u, v) per corner. */
  quad(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    color: Color,
    kind: Surface,
    uv: readonly [number, number, number, number, number, number, number, number] = [
      0, 0, 1, 0, 1, 1, 0, 1,
    ],
  ): this {
    const n = faceNormal(a, b, c);
    const corners = [a, b, c, a, c, d];
    const uvs = [
      uv[0],
      uv[1],
      uv[2],
      uv[3],
      uv[4],
      uv[5],
      uv[0],
      uv[1],
      uv[4],
      uv[5],
      uv[6],
      uv[7],
    ];
    // The face's top, so windows and bands know where the wall ends.
    const top = Math.max(uv[1], uv[3], uv[5], uv[7]);
    corners.forEach((p, i) => {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      this.colors.push(color.r, color.g, color.b);
      this.facade.push(uvs[i * 2] ?? 0, uvs[i * 2 + 1] ?? 0, top);
      this.kinds.push(kind);
      this.ids.push(this.currentId);
    });
    return this;
  }

  triangle(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    color: Color,
    kind: Surface,
    uv: readonly number[] = [0, 0, 1, 0, 0.5, 1],
  ): this {
    const n = faceNormal(a, b, c);
    const top = Math.max(uv[1] ?? 0, uv[3] ?? 0, uv[5] ?? 0);
    [a, b, c].forEach((p, i) => {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      this.colors.push(color.r, color.g, color.b);
      this.facade.push(uv[i * 2] ?? 0, uv[i * 2 + 1] ?? 0, top);
      this.kinds.push(kind);
      this.ids.push(this.currentId);
    });
    return this;
  }

  /**
   * A box standing on y = base, centred on (x, z), turned by `angle` around
   * the vertical. Façade coordinates run along each wall in world units.
   */
  box(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: Color,
    options: {
      base?: number;
      angle?: number;
      sides?: Surface;
      top?: Surface | null;
      topColor?: Color;
    } = {},
  ): this {
    const base = options.base ?? 0;
    const sides = options.sides ?? SURFACE.plain;
    const corner = placer(x, z, options.angle ?? 0);
    const hw = width / 2;
    const hd = depth / 2;
    const p = (u: number, y: number, v: number): Vec3 => corner(u, base + y, v);
    const h = height;
    // South, east, north, west walls, each wound so its normal points outward.
    this.quad(p(-hw, 0, hd), p(hw, 0, hd), p(hw, h, hd), p(-hw, h, hd), color, sides, [
      0,
      base,
      width,
      base,
      width,
      base + h,
      0,
      base + h,
    ]);
    this.quad(p(hw, 0, hd), p(hw, 0, -hd), p(hw, h, -hd), p(hw, h, hd), color, sides, [
      0,
      base,
      depth,
      base,
      depth,
      base + h,
      0,
      base + h,
    ]);
    this.quad(p(hw, 0, -hd), p(-hw, 0, -hd), p(-hw, h, -hd), p(hw, h, -hd), color, sides, [
      0,
      base,
      width,
      base,
      width,
      base + h,
      0,
      base + h,
    ]);
    this.quad(p(-hw, 0, -hd), p(-hw, 0, hd), p(-hw, h, hd), p(-hw, h, -hd), color, sides, [
      0,
      base,
      depth,
      base,
      depth,
      base + h,
      0,
      base + h,
    ]);
    if (options.top !== null) {
      this.quad(
        p(-hw, h, hd),
        p(hw, h, hd),
        p(hw, h, -hd),
        p(-hw, h, -hd),
        options.topColor ?? color,
        options.top ?? SURFACE.plain,
        [0, 0, width, 0, width, depth, 0, depth],
      );
    }
    return this;
  }

  /** A pitched roof over a box: ridge along the box's width (east–west before turning). */
  gableRoof(
    x: number,
    z: number,
    width: number,
    depth: number,
    rise: number,
    base: number,
    color: Color,
    options: { angle?: number; gableColor?: Color; overhang?: number; kind?: Surface } = {},
  ): this {
    const roof = options.kind ?? SURFACE.roof;
    const corner = placer(x, z, options.angle ?? 0);
    const o = options.overhang ?? 0.35;
    const hw = width / 2 + o;
    const hd = depth / 2 + o;
    const ridgeA = corner(-hw, base + rise, 0);
    const ridgeB = corner(hw, base + rise, 0);
    const slope = Math.hypot(hd, rise);
    this.quad(corner(-hw, base, hd), corner(hw, base, hd), ridgeB, ridgeA, color, roof, [
      0,
      0,
      width,
      0,
      width,
      slope,
      0,
      slope,
    ]);
    this.quad(corner(hw, base, -hd), corner(-hw, base, -hd), ridgeA, ridgeB, color, roof, [
      0,
      0,
      width,
      0,
      width,
      slope,
      0,
      slope,
    ]);
    const gable = options.gableColor ?? color;
    const gableKind = options.gableColor ? SURFACE.facade : roof;
    this.triangle(
      corner(hw - o, base, hd - o),
      corner(hw - o, base, -hd + o),
      corner(hw - o, base + rise, 0),
      gable,
      gableKind,
      [0, base, depth, base, depth / 2, base + rise],
    );
    this.triangle(
      corner(-hw + o, base, -hd + o),
      corner(-hw + o, base, hd - o),
      corner(-hw + o, base + rise, 0),
      gable,
      gableKind,
      [0, base, depth, base, depth / 2, base + rise],
    );
    return this;
  }

  /** A low hipped roof, the Tuscan kind: four slopes to a short ridge. */
  hipRoof(
    x: number,
    z: number,
    width: number,
    depth: number,
    rise: number,
    base: number,
    color: Color,
    angle = 0,
    kind: Surface = SURFACE.roof,
  ): this {
    const corner = placer(x, z, angle);
    const o = 0.3;
    const hw = width / 2 + o;
    const hd = depth / 2 + o;
    const ridge = Math.max(0, hw - hd);
    const r1 = corner(-ridge, base + rise, 0);
    const r2 = corner(ridge, base + rise, 0);
    const a = corner(-hw, base, hd);
    const b = corner(hw, base, hd);
    const cc = corner(hw, base, -hd);
    const d = corner(-hw, base, -hd);
    const slope = Math.hypot(hd, rise);
    this.quad(a, b, r2, r1, color, kind, [0, 0, width, 0, width - ridge, slope, ridge, slope]);
    this.quad(cc, d, r1, r2, color, kind, [0, 0, width, 0, width - ridge, slope, ridge, slope]);
    this.triangle(b, cc, r2, color, kind, [0, 0, depth, 0, depth / 2, slope]);
    this.triangle(d, a, r1, color, kind, [0, 0, depth, 0, depth / 2, slope]);
    return this;
  }

  /** A regular prism (an octagonal drum, a round tower), `sides` faces, standing on `base`. */
  prism(
    x: number,
    z: number,
    radius: number,
    height: number,
    sides: number,
    color: Color,
    kind: Surface,
    base = 0,
    cap = true,
  ): this {
    const ring = (y: number, r: number): Vec3[] =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        return { x: x + Math.cos(a) * r, y, z: z + Math.sin(a) * r };
      });
    const bottom = ring(base, radius);
    const top = ring(base + height, radius);
    const edge = 2 * radius * Math.sin(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const u0 = i * edge;
      this.quad(bottom[j] as Vec3, bottom[i] as Vec3, top[i] as Vec3, top[j] as Vec3, color, kind, [
        u0,
        base,
        u0 + edge,
        base,
        u0 + edge,
        base + height,
        u0,
        base + height,
      ]);
    }
    if (cap) {
      const centre = { x, y: base + height, z };
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        this.triangle(centre, top[j] as Vec3, top[i] as Vec3, color, SURFACE.plain);
      }
    }
    return this;
  }

  /** A cone or pyramid: a tower's spire, a cypress, a tent. */
  cone(
    x: number,
    z: number,
    radius: number,
    height: number,
    sides: number,
    color: Color,
    kind: Surface,
    base = 0,
  ): this {
    const apex = { x, y: base + height, z };
    const slope = Math.hypot(radius, height);
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = { x: x + Math.cos(a0) * radius, y: base, z: z + Math.sin(a0) * radius };
      const p1 = { x: x + Math.cos(a1) * radius, y: base, z: z + Math.sin(a1) * radius };
      this.triangle(p1, p0, apex, color, kind, [i, 0, i + 1, 0, i + 0.5, slope]);
    }
    return this;
  }

  /**
   * A ribbed dome: `ribs` segments, `rings` bands from the drum to the lantern. Trees use the same
   * shape for their crowns, painted plain.
   */
  dome(
    x: number,
    z: number,
    radius: number,
    rise: number,
    base: number,
    ribs: number,
    color: Color,
    rings = 6,
    kind: Surface = SURFACE.dome,
  ): this {
    const point = (i: number, j: number): Vec3 => {
      const a = (i / ribs) * Math.PI * 2 + Math.PI / ribs;
      const t = j / rings;
      // A pointed (Gothic) profile: wider at the base, rising steeply to the crown.
      const r = radius * Math.cos((t * Math.PI) / 2) ** 0.85;
      const y = base + rise * Math.sin((t * Math.PI) / 2);
      return { x: x + Math.cos(a) * r, y, z: z + Math.sin(a) * r };
    };
    for (let i = 0; i < ribs; i++) {
      for (let j = 0; j < rings; j++) {
        const i1 = (i + 1) % ribs;
        this.quad(point(i1, j), point(i, j), point(i, j + 1), point(i1, j + 1), color, kind, [
          0,
          j / rings,
          1,
          j / rings,
          1,
          (j + 1) / rings,
          0,
          (j + 1) / rings,
        ]);
      }
    }
    return this;
  }

  /** A row of merlons along a wall top from (x0, z0) to (x1, z1). */
  battlements(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    top: number,
    color: Color,
    size = 0.9,
    swallowtail = false,
  ): this {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const count = Math.max(1, Math.floor(length / (size * 2)));
    const angle = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const cx = x0 + (x1 - x0) * t;
      const cz = z0 + (z1 - z0) * t;
      this.box(cx, cz, size, size * 0.8, size * (swallowtail ? 1.1 : 1), color, {
        base: top,
        angle: -angle,
        sides: SURFACE.stone,
      });
      if (swallowtail) {
        // The forked Ghibelline merlon: two small horns on each block.
        this.box(
          cx - size * 0.3 * Math.cos(angle),
          cz - size * 0.3 * Math.sin(angle),
          size * 0.28,
          size * 0.7,
          size * 0.5,
          color,
          { base: top + size * 1.1, angle: -angle, sides: SURFACE.stone },
        );
        this.box(
          cx + size * 0.3 * Math.cos(angle),
          cz + size * 0.3 * Math.sin(angle),
          size * 0.28,
          size * 0.7,
          size * 0.5,
          color,
          { base: top + size * 1.1, angle: -angle, sides: SURFACE.stone },
        );
      }
    }
    return this;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    geometry.setAttribute('aFacade', new BufferAttribute(new Float32Array(this.facade), 3));
    geometry.setAttribute('aKind', new BufferAttribute(new Float32Array(this.kinds), 1));
    geometry.setAttribute('aId', new BufferAttribute(new Float32Array(this.ids), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / length, y: ny / length, z: nz / length };
}

/** Local (u along, y up, v across) to world, for a footprint centred on (x, z) and turned by `angle`. */
function placer(x: number, z: number, angle: number): (u: number, y: number, v: number) => Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (u, y, v) => ({ x: x + u * cos + v * sin, y, z: z - u * sin + v * cos });
}
