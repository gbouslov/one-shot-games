# First-person starter

A complete small first-person game in one HTML file: walk, sprint, jump, look, three kinds of weapon, enemies that path to you, waves, win, lose and restart. Sound and textures are generated in code.

```bash
npm run build      # from the repo root; writes dist/index.html here
npm run playtest
```

Make a game from it with `npm run new -- <slug>`, then rewrite `src/game/`:

| `src/game/` | What it is |
|---|---|
| `rules.js` | Title, waves, end screens |
| `world.js` | The level |
| `look.js` | Sky, light, fog, grade |
| `weapons.js` | Weapons: stats, models, sounds |
| `enemies.js` | Enemies: stats, models, animation |
| `sounds.js` | Extra sounds and ambience |
| `shots.js` | Named screenshots |
| `config.js` | Feel and HUD colours |

`src/kit/` is the tested engine; `skills/build-from-pieces` maps what each part does. The default game, Proving Ground, is deliberately neutral. Replace it.

## Arms

The default carbine ("AR carbine") is held by rigged, animated gloved arms loaded from a file, with their own idle, shot, draw and reload clips; the pulse gun and the hatchet use the coded hands. The choice is one line on a weapon in `src/game/weapons.js`:

```js
viewmodel: { arms: 'asset', url: armsRifle, ...ARMS_RIFLE },   // the file's arms and rifle
// no viewmodel line: the coded Claude-of-Duty hands hold `model`, no asset needed
```

The loader is `src/kit/viewmodel/asset-arms.js`; its header lists the options for other rigs (clip names, eye node, framing, aim pose, muzzle, a held item on a hand bone for bare arms).

For a caveman, primitive or melee game, bare skin arms hold the kit's coded spear, club or hatchet, also in one line:

```js
import { ARMS_BARE, buildSpear, buildClub } from '../kit/viewmodel/index.js';
viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'spear', material: 'hide' }, model: buildSpear, strike: 'thrust',
viewmodel: { arms: 'asset', ...ARMS_BARE, hold: 'club',  material: 'hide' }, model: buildClub,
```

They are "fps arms (rigged only)" by para (CC0, no credit needed; see `NOTICES.md`), 0.26 MB, bundled only when a weapon uses them. The rig has no clips: `src/kit/viewmodel/bare-arms.js` closes the fists round the item, solves both arms to it with shoulders fixed to the body, and the kit's sway, bob, swing, thrust, throw and draw layers drive it. Holds: `onehand`/`club`/`hatchet`, `twohand`/`spear`, `thrown`, or your own. Looks: `skin`, `hide`, `leather`, or `{ tint, roughness, wrap, map }`.

Credit (CC BY 4.0, also shown on the title screen): This work is based on "FPS AK-74m animations" (https://sketchfab.com/3d-models/fps-ak-74m-animations-94be8385c402474cacd39bc096c6ca14) by Cransh (https://sketchfab.com/ccransh) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). What was changed is in `NOTICES.md`.

Controls: WASD move, mouse aim, click fire, R reload, 1 2 3 or Q swap, Space jump, Shift sprint, C crouch. When a page refuses pointer lock: drag to look, click to fire once, hold right button or F to keep firing.

URL options: `?q=low|medium|high` sets quality, `?look=drag` forces the drag controls.
