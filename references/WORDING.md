# Wording: what the player reads

Rule, from the 11 Nov 2026 review of Cold Chain and Last Firing against Saltline, where the first games' text read as "AI slop":

- Player text is an objective, a direction, a count or a named person on a radio.
- No puns on the title or the job, no two-beat poetic lines, no vague "something" or "they" as the subject, no clichés.
- Every end screen shows numbers. The kit's `round.js` appends wave, kills, time and accuracy to whatever the game's `winScreen` and `loseScreen` say, so keep their `text` to two or three words.
- `skills/design-brief` asks for this text in DESIGN.md, and the `visual-critic` agent marks violations down.

## Why the old text failed
Saltline's text tells you what to do and where the danger is ("CUT THE THREE UPLINK RELAYS", "CONTACT – WEST", a person on the radio). Ours described a mood: puns ("Shift over", "Clocked out"), poetic closers ("The lights come back. The cold holds."), "Something in the racking", a cliché ("did not get the memo"), and no number or instruction anywhere.

## Before and after

| Where | Before | After |
|---|---|---|
| Cold Chain tagline | Night shift. The power is out and the freezers are warming. Something came in on the last truck. Hold until the generator is back. | Kessler Cold Store, 02:10. Power is out and the freezers are warming. Hold the loading dock through 3 waves until the generator restarts. |
| Cold Chain waves | Something in the racking / They are coming along the floor / The foreman is up | WAVE 1/3 · MOTION IN THE RACKING / WAVE 2/3 · CRAWLERS – CHECK UNDER THE RACKS / WAVE 3/3 · FOREMAN – AIM FOR THE HEAD |
| Cold Chain win, lose | Generator on: The lights come back. The cold holds. / Shift over: The cold chain is broken. | Generator online: Dock held. / You died: Dock lost. Both followed by wave, kills, time, accuracy |
| Last Firing tagline | The brickworks is dead. Something in the kiln sheds did not get the memo. Hold the yard until the sun is down. | Ashby Brickworks, 18:40. The security units in the kiln sheds have switched on. Hold the yard through 3 waves until sundown. |
| Last Firing waves | First shift / They found the stair / The furnace walks | WAVE 1/3 · 4 UNITS FROM THE KILN SHEDS / WAVE 2/3 · DRONES OVERHEAD – LOOK UP / WAVE 3/3 · HEAVY UNIT – AIM FOR THE HEAD |
| Last Firing win, lose | Sun down: The yard is quiet. The chimney is cold. / Clocked out: The machines kept the yard. | Sundown – yard held: Yard held. / You died: Yard lost. Both followed by the stats |
