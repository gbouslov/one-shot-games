// Named set-ups for `npm run capture`; the tool then runs 30 updates and takes the picture.
import { control } from '../kit/boot.js';

export function makeShots({ g, setPhase, trySwap, B, R }) {
  const settle = () => {
    for (let i = 0; i < g.pieces.length; i++) g.pieces[i].pos.y = Math.floor(i / R.width) + 0.5;
    setPhase('idle');
  };
  return {
    title: { state: 'title', apply: () => settle() },
    board: { apply: () => { control.start(); settle(); g.cursor = { x: 2, y: 4 }; g.grabbed = true; } },
    match: {
      // a swap that makes a match, caught as the pieces burst
      apply: () => {
        control.start();
        settle();
        const mv = B.findMove(g.grid);
        g.cursor = { x: mv.x, y: mv.y };
        trySwap(mv.x, mv.y, mv.x + mv.dx, mv.y + mv.dy);
      },
    },
    cascade: {
      // a column dropping into place after a clear
      apply: () => {
        control.start();
        settle();
        for (let i = 0; i < g.pieces.length; i++) {
          const y = Math.floor(i / R.width);
          if (y >= 4) g.pieces[i].pos.y += 3 + (i % R.width) * 0.25;
        }
        setPhase('fall');
      },
    },
  };
}
