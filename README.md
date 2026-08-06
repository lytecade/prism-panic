# Prism Panic 🎮

A cyberpunk-themed memory match flash card game built with vanilla HTML5 Canvas and JavaScript.

## Gameplay

Match all 6 pairs of colored shapes before the 5-minute timer runs out! Each card displays a unique combination of shape and color. Flip cards using mouse, touch, or keyboard controls.

### Shapes
- Circle • Square • Triangle • Star • Heart • Diamond

### How to Play
1. Start at the title screen by clicking, tapping, or pressing any key
2. Study the cards during the 3-second preview phase
3. Flip two cards at a time to find matching pairs
4. Matched pairs stay face-up; mismatches flip back with a miss penalty
5. Clear all 6 pairs before time runs out to win!

### Controls

| Input | Action |
|-------|--------|
| **Mouse/Touch** | Click or tap a card to flip it |
| **Arrow Keys** | Navigate the card selector |
| **Enter / Space** | Flip the selected card |

### Scoring

```
Score = (Remaining Seconds × 5) - (Misses × 50)
Minimum score on a win: 1 point
```

- **Remaining time bonus**: Each second left is worth 5 points
- **Miss penalty**: Each wrong pair costs 50 points
- Even with zero or negative calculated points, a win awards at least 1 point

## Color Scheme

Built using the **Arne16** monochrome-inspired palette:

| Hex | Role |
|-----|------|
| `#000000` | Background (black) |
| `#1B2632` | Deep panels (dark navy) |
| `#9D9D9D` | Text accents (gray) |
| `#FFFFFF` | Highlights (white) |
| `#BE2633` | Card color 1 (crimson) |
| `#E06F8B` | Card color 2 (pink) |
| `#493C2B` | UI elements (brown) |
| `#A46422` | UI elements (bronze) |
| `#EB8931` | Card color 3 (orange) |
| `#F7E26B` | Card color 4 (gold) |
| `#2F484E` | UI elements (slate) |
| `#44891A` | UI elements (forest) |
| `#A3CE27` | Card color 5 (lime) |
| `#005784` | UI elements (ocean) |
| `#31A2F2` | Card color 6 (sky) |
| `#B2DCFF` | Glows (ice) |

## File Structure

```
ppanic/
├── README.md    # This file
├── index.html   # Game shell and styles
└── game.js      # All game logic and rendering
```

## Requirements

- Any modern browser with HTML5 Canvas support
- No external libraries or dependencies
- Works on desktop and mobile

## License

Free to use, modify, and distribute.
