/**
 * The default game: "The Cinder Causeway". A courier carries the last ember
 * along a road of basalt columns across a burning sea at dusk, to relight the
 * dark beacon at its far end. Everything a rewrite is likely to change first
 * lives here, in rules.js and in look.js.
 */
export default {
  quality: 'medium',
  fov: 62,
  far: 2400,
  worldSeed: 11, // the scenery's layout; ?seed= changes the course and effects, never the land

  text: {
    kicker: 'A courier’s run',
    title: 'The Cinder Causeway',
    tagline: 'The beacon at the end of the causeway has gone dark. Carry the last ember 1,500 metres over the burning sea and light it.',
    keys: [
      ['← →  or  A D', 'Change lane'],
      ['↑  W  or  Space', 'Jump'],
      ['↓  or  S', 'Slide'],
      ['M', 'Sound on / off'],
    ],
    touchKeys: 'Swipe left or right to change lane, up to jump, down to slide.',
    start: 'Click or press Enter to run',
    pickupName: 'Cinders',
    heartsName: 'Ember',
    toGoal: 'to the beacon',
    milestone: '{left} m to the beacon',
    hitToast: 'The ember gutters',
    lastHeart: 'One flame left',
    wonKicker: 'The causeway is crossed',
    wonTitle: 'The beacon burns',
    again: 'Click or press Enter to run again',
    lostKicker: 'Run over',
    lostHits: 'The ember went out',
    lostOther: 'Called back',
    // CC-BY assets must be credited where players see them (full list in NOTICES.md).
    credits: 'Models: "Basalt Column Outcrop", "Basalt Boulder" and "Lava Rock Pile" by Polyfork, CC BY 4.0. Courier: "Rogue hooded" by Kay Lousberg (KayKit), CC0.',
  },
};
