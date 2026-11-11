/**
 * Lays out a round: rows of obstacles along the path, pickups between them.
 * Built once per round from the round's random stream, so the bot and the
 * player read the same course, and a seed replays it.
 *
 *   const course = buildCourse(rules, rng)
 *     course.obstacles  [{ id, kind, s, depth, lanes: [..] | null (all), y0, y1 }]
 *     course.pickups    [{ id, s, lane, y }]
 *
 * rules.obstacles: { kind: { y: [bottom, top], depth, full, from } }
 *   An obstacle blocks the box (its lanes, s..s+depth, y0..y1) in track space.
 *   Low ones (top under the jump) are jumped, high ones (bottom over the slide
 *   height) are slid under, tall ones are dodged by changing lane.
 * rules.course: { start, end, gap: [first, last] seconds of travel between rows,
 *   patterns: [{ kinds: [...], lanes: n, weight, from }], pickups: {...} }
 *
 * Pacing after omsingh02/bunny (MIT): rows come at an interval that shrinks
 * as speed rises, and pickups are kept out of lanes an obstacle blocks. The
 * rule that a row never blocks every lane with something tall is after
 * juwalbose/ThreeJSEndlessRunner3D's addPathTree (MIT). The row patterns,
 * the jump arcs and slide lines of pickups and the rest are new.
 */
export function buildCourse(rules, rng, speedAt) {
  const C = rules.course;
  const K = rules.obstacles;
  const lanes = rules.body.lanes ?? 3;
  const half = (lanes - 1) / 2;
  const all = Array.from({ length: lanes }, (_, i) => i - half);
  const obstacles = [];
  const pickups = [];
  let id = 0;
  const end = C.end;
  let s = C.start;
  let prevFree = [0];
  let lastKinds = [];

  const tall = (kind) => K[kind].y[1] > (rules.body.jumpHeight ?? 1.6) * 0.8 && K[kind].y[0] < (rules.body.slideHeight ?? 0.85);
  const line = (s0, lane, n, spacing, y = 0.9) => {
    for (let i = 0; i < n; i++) pickups.push({ id: id++, s: s0 + i * spacing, lane, y });
  };

  while (s < end) {
    const t = Math.max(0, Math.min(1, (s - C.start) / (end - C.start)));
    const v = speedAt(s);
    const gap = (C.gap[0] + (C.gap[1] - C.gap[0]) * t) * v;
    // Pick a pattern allowed this far in, not the same kinds three times running.
    const allowed = C.patterns.filter((p) => s >= (p.from ?? 0) && !(lastKinds.length >= 2 && lastKinds.every((k) => k === p.kinds.join())));
    let total = 0;
    for (const p of allowed) total += p.weight;
    let r = rng.float() * total;
    let pat = allowed[0];
    for (const p of allowed) {
      r -= p.weight;
      if (r <= 0) {
        pat = p;
        break;
      }
    }
    lastKinds = [...lastKinds.slice(-1), pat.kinds.join()];
    const row = [];
    const full = pat.kinds.length === 1 && K[pat.kinds[0]].full;
    let free = all;
    if (full) {
      const k = K[pat.kinds[0]];
      row.push({ id: id++, kind: pat.kinds[0], s, depth: k.depth, lanes: null, y0: k.y[0], y1: k.y[1] });
      free = all;
    } else {
      // Choose the lanes to block; keep at least one lane clear of anything tall.
      const n = Math.min(lanes, pat.lanes ?? pat.kinds.length);
      const order = [...all].sort(() => rng.float() - 0.5);
      const blocked = order.slice(0, n);
      const kinds = blocked.map((_, i) => pat.kinds[i % pat.kinds.length]);
      if (blocked.length === lanes && kinds.every(tall)) kinds[rng.int(0, lanes - 1)] = Object.keys(K).find((k) => !tall(k) && !K[k].full) ?? kinds[0];
      blocked.forEach((lane, i) => {
        const k = K[kinds[i]];
        row.push({ id: id++, kind: kinds[i], s, depth: k.depth, lanes: [lane], y0: k.y[0], y1: k.y[1] });
      });
      free = all.filter((l) => !blocked.includes(l) || !tall(kinds[blocked.indexOf(l)]));
      // A row where the only way through is a lane two away from the last free lane needs room.
      const reach = Math.min(...free.map((f) => Math.min(...prevFree.map((p) => Math.abs(p - f)))));
      if (reach >= 2) s += v * 0.25;
      for (const o of row) o.s = s;
    }
    obstacles.push(...row);

    // Pickups for this row: an arc over a jump, a low line under an arch, a line through the free lane.
    const P = C.pickups ?? {};
    const lowRow = row.every((o) => o.y1 < 1.2);
    const highRow = row.every((o) => o.y0 > 0.8);
    if (rng.float() < (P.chance ?? 0.75)) {
      if (lowRow && full) {
        const lane = all[rng.int(0, lanes - 1)];
        for (let i = 0; i < 5; i++) {
          const k = (i - 2) / 2.4;
          pickups.push({ id: id++, s: s + row[0].depth / 2 + (i - 2) * v * 0.08, lane, y: 0.7 + 1.25 * (1 - k * k) });
        }
      } else if (highRow && full) {
        line(s - 2, all[rng.int(0, lanes - 1)], 3, 2.2, 0.45);
      } else {
        const lane = free[rng.int(0, free.length - 1)];
        line(s - Math.min(gap * 0.5, v * 0.55), lane, 5, Math.max(2, v * 0.08), 0.9);
      }
    }
    prevFree = free;
    s += gap * (0.9 + rng.float() * 0.25);
  }
  obstacles.sort((a, b) => a.s - b.s);
  pickups.sort((a, b) => a.s - b.s);
  return { obstacles, pickups };
}
