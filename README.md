# Prism Panic

A memory match flash card game built with HTML5 Canvas and vanilla JavaScript.

## Overview

**Prism Panic** challenges players to find all 8 matching pairs of colored shapes on a 4×4 grid of flash cards before the 5-minute timer runs out. Each card features a unique shape and color combination from the Arne16 color palette.

## How to Play

1. Open `index.html` in a web browser.
2. Press any key, click, or tap to start from the title screen.
3. Study all 16 cards for 3 seconds — they flip face down automatically.
4. Flip cards one at a time by tapping/clicking or using keyboard controls.
5. Match pairs of identical shape + color to clear them.
6. Beat the clock! Every remaining second counts toward your score.

## Controls

### Mouse / Touch
- **Click / Tap** a card to flip it

### Keyboard
- **Arrow Keys** — Move the selection cursor across the grid
- **Enter** — Flip the selected card

## Scoring

- **Base points**: Remaining seconds × 5
- **Penalty**: −50 points per missed pair
- **Minimum win score**: 1 point (if total falls to 0 or below, you still get 1)

### Example
- Finish with 120 seconds left, 2 misses: `120 × 5 − (2 × 50) = 400 points`
- Finish with 10 seconds left, 7 misses: `10 × 5 − (7 × 50) = −300` → **1 point**

## Game Rules

- **Cards**: 16 cards (8 pairs) in a 4×4 grid
- **Shapes**: Circle, Square, Triangle, Star, Heart, Diamond, Pentagon, Hexagon
- **Colors**: Each pair has a unique color from the Arne16 palette (no color repeats)
- **Time limit**: 5 minutes (300 seconds)
- **Win**: Match all 8 pairs before time runs out
- **Lose**: Timer reaches zero before all pairs are matched

## Technology

- HTML5 Canvas rendering
- Vanilla JavaScript (no external libraries)
- Arne16 color scheme throughout
- Responsive square canvas that scales to fit any browser window
- Mobile-friendly touch controls

