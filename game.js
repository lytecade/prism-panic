// ============================================================
// Prism Panic — Cyberpunk Memory Match Game
// Vanilla HTML5 Canvas, no external libraries
// ============================================================

(() => {
  "use strict";

  // ── Arne16 Palette ──────────────────────────────────────
  const ARNE = {
    BLACK:      "#000000",
    GRAY:       "#9D9D9D",
    WHITE:      "#FFFFFF",
    RED:        "#BE2633",
    PINK:       "#E06F8B",
    BROWN:      "#493C2B",
    DARK_ORANGE:"#A46422",
    ORANGE:     "#EB8931",
    YELLOW:     "#F7E26B",
    DARK_TEAL:  "#2F484E",
    GREEN:      "#44891A",
    LIME:       "#A3CE27",
    DARK_NAVY:  "#1B2632",
    BLUE:       "#005784",
    LIGHT_BLUE: "#31A2F2",
    LIGHT_CYAN: "#B2DCEF",
  };

  const ARNE_ARRAY = Object.values(ARNE);

  // ── Shapes (8 unique) ───────────────────────────────────
  const SHAPES = [
    "circle", "square", "triangle", "star",
    "heart", "diamond", "pentagon", "hexagon"
  ];

  // Colors used for card pairs (8 distinct, from Arne16 minus neutrals)
  const PAIR_COLORS = [
    ARNE.RED, ARNE.PINK, ARNE.ORANGE, ARNE.YELLOW,
    ARNE.GREEN, ARNE.LIGHT_BLUE, ARNE.LIME, ARNE.DARK_ORANGE
  ];

  // ── Game States ─────────────────────────────────────────
  const STATE = {
    TITLE:    "title",
    PREVIEW:  "preview",
    PLAYING:  "playing",
    WIN:      "win",
    LOSE:     "lose",
  };

  // ── Constants ───────────────────────────────────────────
  const GRID_COLS = 4;
  const GRID_ROWS = 4;
  const TOTAL_PAIRS = 8;
  const TIME_LIMIT = 300;        // 5 minutes in seconds
  const PREVIEW_TIME = 3000;     // 3 seconds preview
  const FLIP_DURATION = 300;     // flip animation ms
  const MISS_PENALTY = 50;
  const POINTS_PER_SECOND = 5;

  // ── Canvas Setup ────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Base size (square) — large enough for clean layout
  const BASE = 700;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(ww, wh);
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    scale = (size * dpr) / BASE;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ── Layout Metrics ──────────────────────────────────────
  const MARGIN = 30;
  const HUD_H = 50;
  const BOARD_TOP = MARGIN + HUD_H + 10;
  const BOARD_SIZE = BASE - 2 * MARGIN - HUD_H - 10;
  const CARD_GAP = 10;
  const CARD_W = (BOARD_SIZE - CARD_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const CARD_H = CARD_W;
  const CARD_RADIUS = 12;

  function cardX(col) { return MARGIN + col * (CARD_W + CARD_GAP); }
  function cardY(row) { return BOARD_TOP + row * (CARD_H + CARD_GAP); }

  // ── Game State ──────────────────────────────────────────
  let gState = STATE.TITLE;
  let cards = [];          // {shape, color, matched, flipped, row, col}
  let timer = TIME_LIMIT;
  let timerAccum = 0;
  let misses = 0;
  let flippedCards = [];   // currently face-up (non-matched)
  let locked = false;      // input lock during animations
  let previewEnd = 0;
  let animating = false;
  let animStart = 0;
  let animType = "";       // "flipUp" | "flipDown" | "revealMatch"
  let animTargets = [];
  let selectRow = 0;
  let selectCol = 0;
  let score = 0;
  let particles = [];

  // ── Card Initialization ─────────────────────────────────
  function initCards() {
    cards = [];
    const pairs = [];
    for (let i = 0; i < TOTAL_PAIRS; i++) {
      pairs.push({ shape: SHAPES[i], color: PAIR_COLORS[i] });
      pairs.push({ shape: SHAPES[i], color: PAIR_COLORS[i] });
    }
    // Fisher-Yates shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    let idx = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        cards.push({
          shape: pairs[idx].shape,
          color: pairs[idx].color,
          matched: false,
          flipped: false,
          row: r,
          col: c,
          flipProgress: 0, // 0 = face down, 1 = face up
        });
        idx++;
      }
    }
  }

  // ── Start Game ──────────────────────────────────────────
  function startGame() {
    gState = STATE.PREVIEW;
    initCards();
    timer = TIME_LIMIT;
    timerAccum = 0;
    misses = 0;
    flippedCards = [];
    locked = false;
    animating = false;
    selectRow = 0;
    selectCol = 0;
    particles = [];
    // All cards face up during preview
    for (const card of cards) {
      card.flipped = true;
      card.flipProgress = 1;
    }
    previewEnd = performance.now() + PREVIEW_TIME;
  }

  // ── Flip Card Helper ────────────────────────────────────
  function flipCard(card, direction) {
    // direction: 1 = face up, -1 = face down
    const target = direction > 0 ? 1 : 0;
    card._flipTarget = target;
  }

  // ── Handle Card Selection ───────────────────────────────
  function selectCard(row, col) {
    if (gState !== STATE.PLAYING) return;
    if (locked || animating) return;
    const card = cards.find(c => c.row === row && c.col === col);
    if (!card) return;
    if (card.matched) return;
    if (card.flipProgress >= 0.5) return; // already face-up

    // Flip this card face up
    card._flipTarget = 1;
    animating = true;

    if (flippedCards.length === 0) {
      // First card flipped — allow next pick after animation
      flippedCards.push(card);
      setTimeout(() => {
        animating = false;
      }, FLIP_DURATION);
    } else if (flippedCards.length === 1) {
      // Second card flipped — check match after animation
      const first = flippedCards[0];
      animating = true;

      setTimeout(() => {
        if (first.shape === card.shape && first.color === card.color) {
          // Match!
          locked = true;
          first.matched = true;
          card.matched = true;
          first.flipProgress = 1;
          first.flipped = true;
          card.flipProgress = 1;
          card.flipped = true;
          first._flipTarget = undefined;
          card._flipTarget = undefined;
          animating = false;
          flippedCards = [];
          spawnMatchParticles(card);
          spawnMatchParticles(first);
          // Check win
          if (cards.every(c => c.matched)) {
            score = Math.max(1, Math.floor(timer) * POINTS_PER_SECOND - misses * MISS_PENALTY);
            gState = STATE.WIN;
          }
          locked = false;
        } else {
          // Mismatch
          misses++;
          // Flip both back
          first._flipTarget = 0;
          card._flipTarget = 0;
          setTimeout(() => {
            animating = false;
            flippedCards = [];
            locked = false;
          }, FLIP_DURATION + 50);
        }
      }, FLIP_DURATION);
    } else {
      animating = false;
    }
  }

  // ── Particles ───────────────────────────────────────────
  function spawnMatchParticles(card) {
    const cx = cardX(card.col) + CARD_W / 2;
    const cy = cardY(card.row) + CARD_H / 2;
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015 + Math.random() * 0.015,
        color: card.color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── Drawing Helpers ─────────────────────────────────────
  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawShape(shape, cx, cy, size, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    switch (shape) {
      case "circle":
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "square":
        ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
        break;

      case "triangle":
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 1.1);
        ctx.lineTo(cx + size * 1.1, cy + size * 0.85);
        ctx.lineTo(cx - size * 1.1, cy + size * 0.85);
        ctx.closePath();
        ctx.fill();
        break;

      case "star":
        drawStar(cx, cy, 5, size * 1.2, size * 0.5);
        break;

      case "heart":
        drawHeart(cx, cy, size * 1.1);
        break;

      case "diamond":
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 1.2);
        ctx.lineTo(cx + size * 0.8, cy);
        ctx.lineTo(cx, cy + size * 1.2);
        ctx.lineTo(cx - size * 0.8, cy);
        ctx.closePath();
        ctx.fill();
        break;

      case "pentagon":
        drawPolygon(cx, cy, 5, size * 1.2);
        break;

      case "hexagon":
        drawPolygon(cx, cy, 6, size * 1.2);
        break;
    }
  }

  function drawStar(cx, cy, points, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawHeart(cx, cy, size) {
    ctx.beginPath();
    const s = size * 0.55;
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.bezierCurveTo(cx - s * 2, cy - s * 0.5, cx - s, cy - s * 2, cx, cy - s * 0.7);
    ctx.bezierCurveTo(cx + s, cy - s * 2, cx + s * 2, cy - s * 0.5, cx, cy + s * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  function drawPolygon(cx, cy, sides, radius) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Draw Card ───────────────────────────────────────────
  function drawCard(card) {
    const x = cardX(card.col);
    const y = cardY(card.row);

    // flipProgress: 0 = face down, 1 = face up
    // Visual threshold at 0.5
    const progress = card.flipProgress;
    const faceUp = progress >= 0.5;

    if (faceUp) {
      // Fully face up
      // Card background
      drawRoundedRect(x, y, CARD_W, CARD_H, CARD_RADIUS);
      if (card.matched) {
        ctx.fillStyle = "#0a1a2a";
        ctx.fill();
        ctx.strokeStyle = card.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Draw shape with glow
        const cx = x + CARD_W / 2;
        const cy = y + CARD_H / 2;
        ctx.shadowColor = card.color;
        ctx.shadowBlur = 12;
        drawShape(card.shape, cx, cy, CARD_W * 0.25, card.color);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = ARNE.DARK_NAVY;
        ctx.fill();
        ctx.strokeStyle = ARNE.LIGHT_BLUE;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Draw shape
        const cx = x + CARD_W / 2;
        const cy = y + CARD_H / 2;
        drawShape(card.shape, cx, cy, CARD_W * 0.25, card.color);
        // Shape label
        ctx.fillStyle = ARNE.GRAY;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(card.shape.toUpperCase(), cx, y + CARD_H - 8);
      }
    } else {
      // Face down — cyberpunk pattern
      drawRoundedRect(x, y, CARD_W, CARD_H, CARD_RADIUS);
      ctx.fillStyle = ARNE.DARK_TEAL;
      ctx.fill();
      ctx.strokeStyle = ARNE.LIGHT_BLUE;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner pattern
      const cx = x + CARD_W / 2;
      const cy = y + CARD_H / 2;
      // Prism symbol
      ctx.strokeStyle = ARNE.LIGHT_BLUE;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      drawPolygon(cx, cy, 6, CARD_W * 0.28);
      ctx.stroke();
      // Inner diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + 10, cy);
      ctx.lineTo(cx, cy + 14);
      ctx.lineTo(cx - 10, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Corner accents
      const accent = 12;
      ctx.strokeStyle = ARNE.LIME;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x + 4, y + accent);
      ctx.lineTo(x + 4, y + 4);
      ctx.lineTo(x + accent, y + 4);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + CARD_W - accent, y + 4);
      ctx.lineTo(x + CARD_W - 4, y + 4);
      ctx.lineTo(x + CARD_W - 4, y + accent);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x + 4, y + CARD_H - accent);
      ctx.lineTo(x + 4, y + CARD_H - 4);
      ctx.lineTo(x + accent, y + CARD_H - 4);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + CARD_W - accent, y + CARD_H - 4);
      ctx.lineTo(x + CARD_W - 4, y + CARD_H - 4);
      ctx.lineTo(x + CARD_W - 4, y + CARD_H - accent);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ── Draw HUD ────────────────────────────────────────────
  function drawHUD() {
    // Timer bar
    const barW = BASE - 2 * MARGIN;
    const barH = 8;
    const barX = MARGIN;
    const barY = MARGIN + 10;

    drawRoundedRect(barX, barY, barW, barH, 4);
    ctx.fillStyle = ARNE.DARK_NAVY;
    ctx.fill();

    const pct = Math.max(0, timer / TIME_LIMIT);
    if (pct > 0) {
      let barColor = ARNE.LIGHT_BLUE;
      if (pct < 0.25) barColor = ARNE.RED;
      else if (pct < 0.5) barColor = ARNE.ORANGE;
      else if (pct < 0.75) barColor = ARNE.YELLOW;

      drawRoundedRect(barX, barY, barW * pct, barH, 4);
      ctx.fillStyle = barColor;
      ctx.fill();
    }

    // Timer text
    const mins = Math.floor(timer / 60);
    const secs = Math.floor(timer % 60);
    ctx.fillStyle = ARNE.WHITE;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${mins}:${secs.toString().padStart(2, "0")}`, BASE / 2, MARGIN + 40);

    // Misses
    ctx.textAlign = "left";
    ctx.font = "14px monospace";
    ctx.fillStyle = ARNE.RED;
    ctx.fillText(`MISSES: ${misses}`, MARGIN, MARGIN + 40);

    // Pairs found
    const found = cards.filter(c => c.matched).length / 2;
    ctx.textAlign = "right";
    ctx.fillStyle = ARNE.LIME;
    ctx.fillText(`PAIRS: ${found}/${TOTAL_PAIRS}`, BASE - MARGIN, MARGIN + 40);
  }

  // ── Draw Selector Cursor ────────────────────────────────
  function drawSelector() {
    if (gState !== STATE.PLAYING) return;
    const x = cardX(selectCol);
    const y = cardY(selectRow);

    ctx.save();
    ctx.strokeStyle = ARNE.LIME;
    ctx.lineWidth = 3;
    ctx.shadowColor = ARNE.LIME;
    ctx.shadowBlur = 8;

    // Animated brackets
    const t = performance.now() / 300;
    const offset = Math.sin(t) * 2;

    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(x - 4 + offset, y + 14);
    ctx.lineTo(x - 4 + offset, y - 4);
    ctx.lineTo(x + 14, y - 4);
    ctx.stroke();

    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(x + CARD_W - 14, y - 4);
    ctx.lineTo(x + CARD_W + 4 - offset, y - 4);
    ctx.lineTo(x + CARD_W + 4 - offset, y + 14);
    ctx.stroke();

    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(x - 4 + offset, y + CARD_H - 14);
    ctx.lineTo(x - 4 + offset, y + CARD_H + 4);
    ctx.lineTo(x + 14, y + CARD_H + 4);
    ctx.stroke();

    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(x + CARD_W - 14, y + CARD_H + 4);
    ctx.lineTo(x + CARD_W + 4 - offset, y + CARD_H + 4);
    ctx.lineTo(x + CARD_W + 4 - offset, y + CARD_H - 14);
    ctx.stroke();

    ctx.restore();
  }

  // ── Title Screen ────────────────────────────────────────
  let titlePulse = 0;
  function drawTitleScreen(dt) {
    titlePulse += dt * 0.003;

    // Background
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, BASE, BASE);

    // Grid lines (cyberpunk feel)
    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BASE; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, BASE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BASE, i);
      ctx.stroke();
    }

    // Title
    ctx.save();
    ctx.shadowColor = ARNE.LIGHT_BLUE;
    ctx.shadowBlur = 20 + Math.sin(titlePulse) * 10;
    ctx.fillStyle = ARNE.LIGHT_BLUE;
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PRISM PANIC", BASE / 2, BASE * 0.3);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Subtitle
    ctx.fillStyle = ARNE.LIME;
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MEMORY MATCH // CYBERPUNK EDITION", BASE / 2, BASE * 0.39);

    // Decorative shapes
    const shapeSize = 28;
    const rowY = BASE * 0.52;
    const spacing = BASE / (SHAPES.length + 1);
    for (let i = 0; i < SHAPES.length; i++) {
      const sx = spacing * (i + 1);
      drawShape(SHAPES[i], sx, rowY, shapeSize, PAIR_COLORS[i]);
    }

    // Start prompt
    const alpha = 0.5 + 0.5 * Math.sin(titlePulse * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ARNE.WHITE;
    ctx.font = "bold 22px monospace";
    ctx.fillText("[ PRESS ANY KEY / TAP TO START ]", BASE / 2, BASE * 0.7);
    ctx.globalAlpha = 1;

    // Controls info
    ctx.fillStyle = ARNE.GRAY;
    ctx.font = "13px monospace";
    ctx.fillText("MOUSE: CLICK CARD TO FLIP", BASE / 2, BASE * 0.82);
    ctx.fillText("KEYBOARD: ARROW KEYS + ENTER", BASE / 2, BASE * 0.87);

    // Version
    ctx.fillStyle = ARNE.DARK_TEAL;
    ctx.font = "11px monospace";
    ctx.fillText("v1.0 // ARNE16 PALETTE", BASE / 2, BASE * 0.95);
  }

  // ── Preview Screen ──────────────────────────────────────
  function drawPreviewScreen() {
    // Background
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, BASE, BASE);

    // Grid lines
    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BASE; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, BASE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BASE, i);
      ctx.stroke();
    }

    drawHUD();

    // Draw all cards face up
    for (const card of cards) {
      drawCard(card);
    }

    // Countdown overlay
    const remaining = Math.max(0, previewEnd - performance.now());
    const count = Math.ceil(remaining / 1000);
    const alpha = 0.3 + 0.3 * Math.sin(performance.now() / 200);

    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(MARGIN, BOARD_TOP, BOARD_SIZE, BOARD_SIZE);

    ctx.fillStyle = ARNE.LIGHT_BLUE;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count.toString(), BASE / 2, BOARD_TOP + BOARD_SIZE / 2);

    ctx.fillStyle = ARNE.GRAY;
    ctx.font = "14px monospace";
    ctx.fillText("MEMORIZE THE CARDS", BASE / 2, BOARD_TOP + BOARD_SIZE / 2 + 40);
  }

  // ── Game Screen ─────────────────────────────────────────
  function drawGameScreen() {
    // Background
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, BASE, BASE);

    // Grid lines
    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BASE; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, BASE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BASE, i);
      ctx.stroke();
    }

    drawHUD();

    // Draw cards
    for (const card of cards) {
      drawCard(card);
    }

    // Selector
    drawSelector();

    // Particles
    drawParticles();
  }

  // ── Win Screen ──────────────────────────────────────────
  function drawWinScreen() {
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, BASE, BASE);

    // Grid lines
    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BASE; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, BASE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BASE, i);
      ctx.stroke();
    }

    // Show matched board
    for (const card of cards) {
      drawCard(card);
    }

    // Victory text
    ctx.save();
    ctx.shadowColor = ARNE.LIME;
    ctx.shadowBlur = 15;
    ctx.fillStyle = ARNE.LIME;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SYSTEM", BASE / 2, BASE * 0.3);
    ctx.fillText("UNLOCKED", BASE / 2, BASE * 0.3 + 55);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Score
    ctx.fillStyle = ARNE.YELLOW;
    ctx.font = "bold 36px monospace";
    ctx.fillText(`SCORE: ${score}`, BASE / 2, BASE * 0.55);

    // Stats
    ctx.fillStyle = ARNE.GRAY;
    ctx.font = "16px monospace";
    ctx.fillText(`TIME REMAINING: ${Math.floor(timer)}s`, BASE / 2, BASE * 0.63);
    ctx.fillText(`MISSES: ${misses}`, BASE / 2, BASE * 0.67);

    const alpha = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ARNE.WHITE;
    ctx.font = "bold 20px monospace";
    ctx.fillText("[ PRESS ANY KEY / TAP TO PLAY AGAIN ]", BASE / 2, BASE * 0.8);
    ctx.globalAlpha = 1;
  }

  // ── Lose Screen ─────────────────────────────────────────
  function drawLoseScreen() {
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, BASE, BASE);

    // Grid lines
    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BASE; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, BASE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BASE, i);
      ctx.stroke();
    }

    // Show board with remaining cards
    for (const card of cards) {
      drawCard(card);
    }

    // Defeat text
    ctx.save();
    ctx.shadowColor = ARNE.RED;
    ctx.shadowBlur = 15;
    ctx.fillStyle = ARNE.RED;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SYSTEM", BASE / 2, BASE * 0.3);
    ctx.fillText("LOCKED", BASE / 2, BASE * 0.3 + 55);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Stats
    ctx.fillStyle = ARNE.GRAY;
    ctx.font = "18px monospace";
    const matched = cards.filter(c => c.matched).length / 2;
    ctx.fillText(`PAIRS FOUND: ${matched}/${TOTAL_PAIRS}`, BASE / 2, BASE * 0.55);
    ctx.fillText(`MISSES: ${misses}`, BASE / 2, BASE * 0.60);

    const alpha = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ARNE.WHITE;
    ctx.font = "bold 20px monospace";
    ctx.fillText("[ PRESS ANY KEY / TAP TO TRY AGAIN ]", BASE / 2, BASE * 0.8);
    ctx.globalAlpha = 1;
  }

  // ── Update Flip Animations ──────────────────────────────
  function updateFlips(now) {
    for (const card of cards) {
      if (card._flipTarget !== undefined) {
        const diff = card._flipTarget - card.flipProgress;
        if (Math.abs(diff) > 0.005) {
          card.flipProgress += diff * 0.2;
        } else {
          card.flipProgress = card._flipTarget;
          card.flipped = card._flipTarget === 1;
          card._flipTarget = undefined;
        }
      }
    }
  }

  // ── Input Handling ──────────────────────────────────────
  function getCardAt(px, py) {
    // Convert screen coords to canvas coords
    const rect = canvas.getBoundingClientRect();
    const sx = (px - rect.left) / rect.width * BASE;
    const sy = (py - rect.top) / rect.height * BASE;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cx = cardX(c);
        const cy = cardY(r);
        if (sx >= cx && sx <= cx + CARD_W && sy >= cy && sy <= cy + CARD_H) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  function handleInput(row, col) {
    if (gState === STATE.TITLE) {
      startGame();
      return;
    }
    if (gState === STATE.WIN || gState === STATE.LOSE) {
      startGame();
      return;
    }
    if (gState === STATE.PLAYING) {
      selectCard(row, col);
      return;
    }
  }

  // Mouse
  canvas.addEventListener("click", (e) => {
    const hit = getCardAt(e.clientX, e.clientY);
    if (hit) {
      handleInput(hit.row, hit.col);
    } else {
      // Click outside grid — still valid for title/end screens
      if (gState === STATE.TITLE || gState === STATE.WIN || gState === STATE.LOSE) {
        startGame();
      }
    }
  });

  // Touch
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const hit = getCardAt(touch.clientX, touch.clientY);
    if (hit) {
      handleInput(hit.row, hit.col);
    } else {
      if (gState === STATE.TITLE || gState === STATE.WIN || gState === STATE.LOSE) {
        startGame();
      }
    }
  }, { passive: false });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (gState === STATE.TITLE) {
      startGame();
      return;
    }
    if (gState === STATE.WIN || gState === STATE.LOSE) {
      startGame();
      return;
    }
    if (gState === STATE.PLAYING) {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          selectRow = Math.max(0, selectRow - 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          selectRow = Math.min(GRID_ROWS - 1, selectRow + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          selectCol = Math.max(0, selectCol - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          selectCol = Math.min(GRID_COLS - 1, selectCol + 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          selectCard(selectRow, selectCol);
          break;
      }
    }
  });

  // ── Main Loop ───────────────────────────────────────────
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = now - lastTime;
    lastTime = now;

    // Update timer
    if (gState === STATE.PLAYING || gState === STATE.PREVIEW) {
      timerAccum += dt;
      if (timerAccum >= 1000) {
        timerAccum -= 1000;
        timer--;
        if (timer <= 0) {
          timer = 0;
          gState = STATE.LOSE;
        }
      }
    }

    // End preview
    if (gState === STATE.PREVIEW && now >= previewEnd) {
      gState = STATE.PLAYING;
      // Flip all cards face down instantly
      for (const card of cards) {
        card.flipped = false;
        card.flipProgress = 0;
        card._flipTarget = undefined;
        card.matched = false;
      }
    }

    // Update flips
    updateFlips(now);

    // Update particles
    updateParticles();

    // Draw
    switch (gState) {
      case STATE.TITLE:
        drawTitleScreen(dt);
        break;
      case STATE.PREVIEW:
        drawPreviewScreen();
        break;
      case STATE.PLAYING:
        drawGameScreen();
        break;
      case STATE.WIN:
        drawWinScreen();
        break;
      case STATE.LOSE:
        drawLoseScreen();
        break;
    }

    requestAnimationFrame(gameLoop);
  }

  // ── Start ───────────────────────────────────────────────
  requestAnimationFrame(gameLoop);
})();
