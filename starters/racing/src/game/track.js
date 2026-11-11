/**
 * The default circuit: Amberline Ring, a hillside loop raced at sundown.
 * Main straight -> long sweeping left -> climb to a blind crest -> hairpin ->
 * a downhill S through the orchard -> wide final left onto the straight.
 *
 * Rewrite this file for a new game: control points (y = road height), widths,
 * where the item rows and boost pads sit (track t, 0..1 from the finish line),
 * the light and the colours. `theme` picks the decor set the kit builds:
 * 'grassland' | 'desert' | 'snow' | 'neon' (beach and volcano fall back to
 * grassland and desert decor). Keep the length 850-1450 m and sections at
 * least 3.5 road widths apart, or barriers of two sections will overlap.
 */
export default {
  id: 'amberline_ring',
  name: 'Amberline Ring',
  theme: 'grassland',
  laps: 3,
  description: 'A hillside loop raced at sundown: one blind crest, one hairpin, one orchard S.',
  difficulty: 2,
  controlPoints: [
    { x: 0, y: 0, z: 0 }, // 0 finish line
    { x: 0, y: 0, z: -70 },
    { x: 0, y: 0.5, z: -135 },
    { x: -14, y: 1.2, z: -176 }, // long sweeping left
    { x: -48, y: 2, z: -199 },
    { x: -92, y: 3, z: -204 },
    { x: -132, y: 4.5, z: -188 },
    { x: -156, y: 6.5, z: -152 }, // climb
    { x: -162, y: 8.5, z: -105 },
    { x: -160, y: 9.5, z: -60 }, // blind crest
    { x: -150, y: 6, z: -12 },
    { x: -132, y: 3.5, z: 26 }, // hairpin entry
    { x: -108, y: 3, z: 44 },
    { x: -86, y: 3, z: 30 },
    { x: -86, y: 2.5, z: 0 }, // hairpin exit, heading back up
    { x: -96, y: 2, z: -38 },
    { x: -76, y: 1.5, z: -72 }, // orchard S
    { x: -46, y: 1, z: -66 },
    { x: -40, y: 0.6, z: -30 },
    { x: -52, y: 0.4, z: 8 },
    { x: -46, y: 0.2, z: 50 }, // wide final left
    { x: -24, y: 0, z: 72 },
    { x: 0, y: 0, z: 56 },
  ],
  halfWidth: 8,
  wallHalfWidthFactor: 1.5,
  itemBoxRows: [0.12, 0.47, 0.8],
  boostPads: [0.36, 0.9],
  environment: {
    skyTop: 0x3a5a9a,
    skyHorizon: 0xffb27a,
    skyBottom: 0xffd7a8,
    fogColor: 0xf3b98a,
    fogDensity: 0.0026,
    sunColor: 0xffc48a,
    sunIntensity: 3.1,
    sunDirection: { x: -0.62, y: 0.3, z: -0.72 },
    ambientSky: 0x8fa6d8,
    ambientGround: 0x6a4a2c,
    ambientIntensity: 0.75,
    clouds: { cover: 0.5, lit: 0xffd8b0, shade: 0x5e4c6e },
  },
  sponsors: [
    { text: 'AMBERLINE GP', bg: 0x1a1612, fg: 0xffc46a, accent: 0xff6a2a },
    { text: 'COPPERLEAF TYRES', bg: 0x2a3a2a, fg: 0xf4efe0, accent: 0xd8a24a },
    { text: 'SUNDOWN FUEL', bg: 0xc0452a, fg: 0xfff2d8, accent: 0x1a1612 },
  ],
  roadRoughness: 0.68,
  palette: {
    road: 0x46474c,
    roadStripe: 0xf2ecdc,
    curb: 0xd2452a,
    curbAlt: 0xf4efe0,
    offroad: 0x6e8a3a,
    wall: 0x2a2a2e,
    ground: 0x5f7f30,
  },
};
