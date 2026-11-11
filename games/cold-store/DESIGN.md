# Cold Chain
> Okay awesome.. now create a completely separate triple AAA game to prove the point of how fast we can do this..

**Premise:** You're the night guard at a frozen-food distribution warehouse, and the power has just died. Whatever came in on the last refrigerated truck is thawing out among the racking. Hold out with a flashlight and what's in the guard hut until the generator is back.

**First second:** A flashlight cone in a dark aisle between 7 m pallet racks. A red emergency strobe sweeps the far end. Breath-fog drifts through the beam, and frost glints on the shrink-wrap.

**Verb, and two more:** shoot into the light. Also: sweep the dark with the flashlight cone, and swap to the machete when a creature is too close.

**Loop:** hear something in an aisle → light it → kill it → the next wave comes from a different loading door, bigger. The aisles split the room, so you are always choosing which dark gap to watch.

**Scope:**
- **Place:** one warehouse hall, about 40 × 30 m and 9 m to the roof trusses, with three long aisles of pallet racking, a loading dock with two roller doors and a lit guard hut.
- **Enemies:** the night shift, frozen and thawing: realistic rigged workers (MakeHuman, CC0) posed by code. The Thawed (a walker in overalls that grabs), the Rimecrawler (a worker on all fours, fast and low) and the Foreman (a heavyset one in hi-vis overalls and a hard hat, last wave).
- **Tools:** the KV-9 compact 9 mm with a 3x magnifying sight (the lens renders a zoomed view) and a rail light, a P-12 service pistol, and a machete (a scan). All three on the kit's coded gloved hands, both hands on the firearms.
- **Round:** three waves, about four minutes. While they come: RESET 3 BREAKERS (west wall, dock, east wall; stand at a panel 1.5 s). All 3 on starts the generator and the hall lights. Win, loss and restart included; the end screen shows breakers, wave, kills, time, accuracy and score.

**Look:** night, cold, sodium, strobe, frost.
- **Palette:** freezer blue `#2c3c52`, sodium amber `#ffb35a`, emergency red `#ff2a1a`, concrete grey `#6a6866`.
- **The glow:** the flashlight is the main light. The rest comes from one flickering sodium lamp per aisle, the red strobes on the loading doors and the warm guard hut window.

**Sound:** a dead-quiet hall with a ticking roof, the drip of a thawing compressor and a distant alarm chirp. Creatures make wet clicks.

**HUD (second pass, kit `hud/shooter-hud.js`):** round minimap with racks and enemy dots, compass with enemy and breaker pips, objective line with counter, WAVE 01 bar with "N REMAINING", score with kill chain, stance, segmented health, weapon block (name, silhouette, magazine pips, AUTO · 9×19, ammo / reserve), contact arc ("CONTACT – WEST"), radio subtitles from DISPATCH, and a map intro card (KESSLER COLD STORE · LOADING DOCK · POWER OUT · −22 °C · FREEZER FOG) over a fly-in.

**Done means:**
1. A stranger can walk, sprint, aim the flashlight with the view, and fire every weapon.
2. All three waves can be cleared, which shows the win screen, and dying shows the loss screen with a restart.
3. The opening view shows racking taller than 6 m, the flashlight cone and a red strobe. It is never a black screen.

**Originality:** The working title "Cold Store" was flagged as close to two itch.io games called "Cold Storage", so it became "Cold Chain". The setting is a generic cold-storage warehouse at night. No names, characters, layouts or looks come from any existing horror game, and it does not share the layout or daylight of Felix's Saltline interior.
