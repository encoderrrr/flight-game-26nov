[![make.fun](https://img.shields.io/badge/make.fun-bounty-39e6c3)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun](https://img.shields.io/badge/make.fun-agent-7fe7ff)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun](https://img.shields.io/badge/make.fun-game-ffb347)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Ridge Runner — Coastal Ring Run

An original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). It plays offline in a desktop browser from its own static files — no network, no build step.

Fly the Kestrel K-7 off a coastal runway and thread all ten glowing rings over the bay, the green valley and the town before your fuel or your time runs out. Land back on the runway to refuel and take off again. A chase view keeps the aircraft in frame with lit instruments: altitude, speed, heading, a compass strip, an attitude indicator, throttle and fuel.

## Controls

- **↑ / ↓** pitch (climb / descend)
- **← / →** or **A / D** bank and turn
- **W / S** throttle up / down (Shift / Ctrl work too)
- **P** pause, **M** mute, **R** restart, **Enter** start
- Mouse: click **START FLYING** and **FLY AGAIN**

## Scoring

- A ring is **+100**, a dead-centre pass **+150**, and each ring adds a little fuel.
- Finishing all ten rings adds **2 points per second left** on the clock.
- Best score is kept in the browser.

## Play it

Serve `game/` with any static server and open `index.html`, for example:

```sh
node serve.ts   # serves game/ on http://localhost:8080 (development only)
```

## Layout

- `main.ts` — the hand-in program (Node 22, stdlib only): copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `game/` — the game itself: `index.html` plus `src/` modules (config, terrain, physics, input, audio, render, game, shots, main). All art is drawn in code; all sound is synthesised with WebAudio.
- `screenshots/` — four real renders of the game's own code in a headless desktop browser: the flight (cover), the title screen, the end screen, and live gameplay.
