/**
 * The guns. Every number here is a feel decision: rate in shots per second,
 * damage per ray, spread in radians, range in metres, magazine and reload in
 * seconds, knockback as a shove multiplier, shake as camera trauma per shot.
 * sound is a kit profile ('light' | 'medium' | 'heavy' | 'soft').
 */
export const weapons = [
  {
    id: 'carbine',
    name: 'Yard Carbine',
    rate: 9.5,
    damage: 24,
    spread: 0.035,
    range: 32,
    magazine: 30,
    reload: 1.25,
    knockback: 0.7,
    shake: 0.08,
    kick: 0.5,
    sound: 'medium',
    tracer: '#ffd39a',
    flash: '#ffb860',
    accent: '#ffb347',
    length: 0.7,
  },
  {
    id: 'scattergun',
    name: 'Breaker',
    rate: 1.7,
    damage: 22,
    pellets: 8,
    spread: 0.15,
    range: 13,
    magazine: 6,
    reload: 1.5,
    knockback: 0.55,
    shake: 0.32,
    kick: 2.2,
    sound: 'heavy',
    tracer: '#ffc27a',
    tracerWidth: 0.035,
    flash: '#ff9d48',
    flashLight: 40,
    flashSize: 1.6,
    accent: '#e8603c',
    length: 0.62,
  },
];
