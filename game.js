// ============================================================
// Prism Panic — Cyberpunk Memory Match Game
// Vanilla HTML5 Canvas, no external libraries
// ============================================================

(() => {
  "use strict";

  // ── Arne16 Palette ──────────────────────────────────────
  const ARNE = {
    BLACK: "#000000",
    GRAY: "#9D9D9D",
    WHITE: "#FFFFFF",
    RED: "#BE2633",
    PINK: "#E06F8B",
    BROWN: "#493C2B",
    DARK_ORANGE: "#A46422",
    ORANGE: "#EB8931",
    YELLOW: "#F7E26B",
    DARK_TEAL: "#2F484E",
    GREEN: "#44891A",
    LIME: "#A3CE27",
    DARK_NAVY: "#1B2632",
    BLUE: "#005784",
    LIGHT_BLUE: "#31A2F2",
    LIGHT_CYAN: "#B2DCEF",
  };

  // ── Shapes (8 unique) ───────────────────────────────────
  const SHAPES = [
    "circle",
    "square",
    "triangle",
    "star",
    "heart",
    "diamond",
    "pentagon",
    "hexagon",
  ];

  // Colors used for card pairs (8 distinct, from Arne16 minus neutrals)
  const PAIR_COLORS = [
    ARNE.RED,
    ARNE.PINK,
    ARNE.ORANGE,
    ARNE.YELLOW,
    ARNE.GREEN,
    ARNE.LIGHT_BLUE,
    ARNE.LIME,
    ARNE.DARK_ORANGE,
  ];

  // ── Game States ─────────────────────────────────────────
  const STATE = {
    TITLE: "title",
    PREVIEW: "preview",
    PLAYING: "playing",
    WIN: "win",
    LOSE: "lose",
  };

  // ── Constants ───────────────────────────────────────────
  const GRID_COLS = 4;
  const GRID_ROWS = 4;
  const TOTAL_PAIRS = 8;
  const TIME_LIMIT = 300; // 5 minutes in seconds
  const PREVIEW_TIME = 3000; // 3 seconds preview
  const FLIP_DURATION = 300; // flip animation ms
  const MISS_PENALTY = 50;
  const POINTS_PER_SECOND = 5;
  const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

  // ── Math Helpers ────────────────────────────────────────
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ── Canvas & Responsive Viewport Setup ──────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let layout = null;
  let frameTextBoxes = [];
  let lastFrameTextBoxes = [];
  let lastOverlayRect = null;
  let lastModalRect = null;

  function getViewportSize() {
    const vv = window.visualViewport;
    const vw = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
    const vh = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
    return { vw, vh };
  }

  function getSafeInsets() {
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseFloat(style.getPropertyValue("--sat")) || 0,
      right: parseFloat(style.getPropertyValue("--sar")) || 0,
      bottom: parseFloat(style.getPropertyValue("--sab")) || 0,
      left: parseFloat(style.getPropertyValue("--sal")) || 0,
    };
  }

  /**
   * Pure layout engine computing HUD, board, and card geometry
   * for any viewport dimensions, orientation, and safe-area insets.
   */
  function computeLayout(vw, vh, insets) {
    const safeX = insets.left;
    const safeY = insets.top;
    const safeW = Math.max(200, vw - insets.left - insets.right);
    const safeH = Math.max(200, vh - insets.top - insets.bottom);

    const marginX = clamp(Math.round(safeW * 0.03), 10, 36);
    const marginY = clamp(Math.round(safeH * 0.03), 10, 36);
    const innerX = safeX + marginX;
    const innerY = safeY + marginY;
    const innerW = Math.max(120, safeW - 2 * marginX);
    const innerH = Math.max(120, safeH - 2 * marginY);

    // Candidate 1: Top HUD + Board below (portrait, square, narrow screens)
    const topCandidate = (() => {
      const hudH = clamp(Math.round(safeH * 0.095), 48, 76);
      const hudGap = clamp(Math.round(safeH * 0.018), 8, 20);
      const availW = innerW;
      const availH = Math.max(120, innerH - hudH - hudGap);
      const cardGap = clamp(Math.round(Math.min(availW, availH) * 0.022), 6, 16);
      const maxCardW = (availW - cardGap * (GRID_COLS - 1)) / GRID_COLS;
      const maxCardH = (availH - cardGap * (GRID_ROWS - 1)) / GRID_ROWS;

      let cardW;
      let cardH;
      if (maxCardH >= maxCardW) {
        cardW = maxCardW;
        cardH = Math.min(maxCardH, maxCardW * 1.28);
      } else {
        cardH = maxCardH;
        cardW = Math.min(maxCardW, maxCardH * 1.12);
      }

      const boardW = cardW * GRID_COLS + cardGap * (GRID_COLS - 1);
      const boardH = cardH * GRID_ROWS + cardGap * (GRID_ROWS - 1);
      const hudW = Math.max(boardW, Math.min(innerW, 280));
      const totalH = hudH + hudGap + boardH;
      const groupTop = innerY + Math.max(0, (innerH - totalH) / 2);

      return {
        hudMode: "top",
        cardW,
        cardH,
        cardGap,
        hudRect: {
          x: innerX + (innerW - hudW) / 2,
          y: groupTop,
          w: hudW,
          h: hudH,
        },
        boardRect: {
          x: innerX + (innerW - boardW) / 2,
          y: groupTop + hudH + hudGap,
          w: boardW,
          h: boardH,
        },
      };
    })();

    // Candidate 2: Side HUD + Board beside (landscape screens)
    let chosen = topCandidate;
    if (safeW > safeH * 1.15 && innerW >= 440) {
      const hudW = clamp(Math.round(innerW * 0.22), 148, 340);
      const hudGap = clamp(Math.round(innerW * 0.025), 12, 32);
      const availW = innerW - hudW - hudGap;
      const availH = innerH;
      const cardGap = clamp(Math.round(Math.min(availW, availH) * 0.022), 6, 16);
      const maxCardW = (availW - cardGap * (GRID_COLS - 1)) / GRID_COLS;
      const maxCardH = (availH - cardGap * (GRID_ROWS - 1)) / GRID_ROWS;

      let cardW;
      let cardH;
      if (maxCardW >= maxCardH) {
        cardH = maxCardH;
        cardW = Math.min(maxCardW, maxCardH * 1.18);
      } else {
        cardW = maxCardW;
        cardH = Math.min(maxCardH, maxCardW * 1.18);
      }

      const boardW = cardW * GRID_COLS + cardGap * (GRID_COLS - 1);
      const boardH = cardH * GRID_ROWS + cardGap * (GRID_ROWS - 1);
      const hudH = boardH;
      const totalW = hudW + hudGap + boardW;
      const groupLeft = innerX + Math.max(0, (innerW - totalW) / 2);
      const groupTop = innerY + Math.max(0, (innerH - boardH) / 2);

      const sideCandidate = {
        hudMode: "side",
        cardW,
        cardH,
        cardGap,
        hudRect: {
          x: groupLeft,
          y: groupTop,
          w: hudW,
          h: hudH,
        },
        boardRect: {
          x: groupLeft + hudW + hudGap,
          y: groupTop,
          w: boardW,
          h: boardH,
        },
      };

      if (
        sideCandidate.cardW * sideCandidate.cardH >=
        topCandidate.cardW * topCandidate.cardH
      ) {
        chosen = sideCandidate;
      }
    }

    const cardRadius = clamp(
      Math.round(Math.min(chosen.cardW, chosen.cardH) * 0.1),
      6,
      16,
    );

    return {
      vw,
      vh,
      dpr: window.devicePixelRatio || 1,
      orientation: vw >= vh ? "landscape" : "portrait",
      hudMode: chosen.hudMode,
      cardW: chosen.cardW,
      cardH: chosen.cardH,
      cardGap: chosen.cardGap,
      cardRadius,
      safeRect: { x: safeX, y: safeY, w: safeW, h: safeH },
      innerRect: { x: innerX, y: innerY, w: innerW, h: innerH },
      hudRect: chosen.hudRect,
      boardRect: chosen.boardRect,
      cardX(col) {
        return chosen.boardRect.x + col * (chosen.cardW + chosen.cardGap);
      },
      cardY(row) {
        return chosen.boardRect.y + row * (chosen.cardH + chosen.cardGap);
      },
    };
  }

  function resize() {
    const { vw, vh } = getViewportSize();
    const dpr = window.devicePixelRatio || 1;
    const insets = getSafeInsets();

    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    layout = computeLayout(vw, vh, insets);
    layout.dpr = dpr;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => {
    resize();
    requestAnimationFrame(resize);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  resize();

  // ── Game State ──────────────────────────────────────────
  let gState = STATE.TITLE;
  let cards = []; // {shape, color, matched, flipped, row, col, flipProgress}
  let timer = TIME_LIMIT;
  let timerAccum = 0;
  let misses = 0;
  let flippedCards = []; // currently face-up (non-matched)
  let locked = false; // input lock during animations
  let previewEnd = 0;
  let animating = false;
  let selectRow = 0;
  let selectCol = 0;
  let score = 0;
  let particles = [];
  let roundId = 0;

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
    roundId++;
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

  // ── Handle Card Selection ───────────────────────────────
  function selectCard(row, col) {
    if (gState !== STATE.PLAYING) return;
    if (locked || animating) return;
    const card = cards.find((c) => c.row === row && c.col === col);
    if (!card) return;
    if (card.matched) return;
    if (card.flipProgress >= 0.5) return; // already face-up

    const myRound = roundId;

    // Flip this card face up
    card._flipTarget = 1;
    animating = true;

    if (flippedCards.length === 0) {
      // First card flipped — allow next pick after animation
      flippedCards.push(card);
      setTimeout(() => {
        if (myRound !== roundId) return;
        animating = false;
      }, FLIP_DURATION);
    } else if (flippedCards.length === 1) {
      // Second card flipped — check match after animation
      const first = flippedCards[0];
      animating = true;

      setTimeout(() => {
        if (myRound !== roundId || gState !== STATE.PLAYING) return;
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
          if (cards.every((c) => c.matched)) {
            score = Math.max(
              1,
              Math.floor(timer) * POINTS_PER_SECOND - misses * MISS_PENALTY,
            );
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
            if (myRound !== roundId) return;
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

  // ── Particles (Rotation-Safe Card-Relative Coords) ──────
  function spawnMatchParticles(card) {
    for (let i = 0; i < 12; i++) {
      const angle = ((Math.PI * 2) / 12) * i + Math.random() * 0.5;
      const speed = 0.025 + Math.random() * 0.04;
      particles.push({
        col: card.col,
        row: card.row,
        ox: 0.5,
        oy: 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.015 + Math.random() * 0.015,
        color: card.color,
        sizeRatio: 0.04 + Math.random() * 0.04,
      });
    }
  }

  function updateParticles(dt) {
    const step = Math.min(dt, 50) / 16.67;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.ox += p.vx * step;
      p.oy += p.vy * step;
      p.life -= p.decay * step;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    const minSide = Math.min(layout.cardW, layout.cardH);
    for (const p of particles) {
      const px = layout.cardX(p.col) + p.ox * layout.cardW;
      const py = layout.cardY(p.row) + p.oy * layout.cardH;
      const sz = Math.max(2, p.sizeRatio * minSide);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // ── Typography Helpers & Bounding Box Recorder ──────────
  function fitFontSize(text, maxWidth, idealSize, minSize = 8, weight = "normal") {
    const safeMax = Math.max(1, maxWidth);
    const prefix = weight === "bold" ? "bold " : "";
    let size = Math.max(minSize, Math.round(idealSize));
    ctx.save();
    ctx.font = `${prefix}${size}px monospace`;
    const w = ctx.measureText(text).width;
    if (w > safeMax && size > minSize) {
      size = Math.max(minSize, Math.floor((size * safeMax) / Math.max(1, w)));
      ctx.font = `${prefix}${size}px monospace`;
      while (size > minSize && ctx.measureText(text).width > safeMax) {
        size -= 1;
        ctx.font = `${prefix}${size}px monospace`;
      }
    }
    ctx.restore();
    return size;
  }

  function drawFittedText(text, x, y, maxWidth, idealSize, opts = {}) {
    const {
      weight = "normal",
      color = ARNE.WHITE,
      align = "center",
      baseline = "middle",
      minSize = 8,
      shadowColor = null,
      shadowBlur = 0,
      alpha = 1,
      layer = "general",
      id = "",
    } = opts;

    const str = String(text);
    const fontSize = fitFontSize(str, maxWidth, idealSize, minSize, weight);
    const prefix = weight === "bold" ? "bold " : "";

    ctx.save();
    ctx.font = `${prefix}${fontSize}px monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.globalAlpha = ctx.globalAlpha * alpha;
    if (shadowColor && shadowBlur > 0) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
    }

    const m = ctx.measureText(str);
    ctx.fillText(str, x, y);
    ctx.restore();

    const w = m.width;
    let left;
    if (align === "center") left = x - w / 2;
    else if (align === "right" || align === "end") left = x - w;
    else left = x;
    const right = left + w;

    let top;
    let bottom;
    if (
      typeof m.actualBoundingBoxAscent === "number" &&
      typeof m.actualBoundingBoxDescent === "number" &&
      (m.actualBoundingBoxAscent > 0 || m.actualBoundingBoxDescent > 0)
    ) {
      top = y - m.actualBoundingBoxAscent;
      bottom = y + m.actualBoundingBoxDescent;
    } else if (baseline === "top") {
      top = y;
      bottom = y + fontSize;
    } else if (baseline === "bottom") {
      top = y - fontSize;
      bottom = y;
    } else {
      top = y - fontSize / 2;
      bottom = y + fontSize / 2;
    }

    frameTextBoxes.push({
      id: id || `${layer}:${str}`,
      layer,
      text: str,
      left,
      top,
      right,
      bottom,
      fontSize,
    });

    return {
      left,
      top,
      right,
      bottom,
      width: w,
      height: bottom - top,
      fontSize,
    };
  }

  // ── Drawing Helpers ─────────────────────────────────────
  function drawBackground() {
    const vw = layout.vw;
    const vh = layout.vh;
    ctx.fillStyle = ARNE.BLACK;
    ctx.fillRect(0, 0, vw, vh);

    const gridStep = clamp(Math.round(Math.min(vw, vh) / 16), 28, 56);
    const cx = vw / 2;
    const cy = vh / 2;
    const startX = cx - Math.ceil(cx / gridStep) * gridStep;
    const startY = cy - Math.ceil(cy / gridStep) * gridStep;

    ctx.strokeStyle = ARNE.DARK_NAVY;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = startX; x <= vw; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
    }
    for (let y = startY; y <= vh; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
    }
    ctx.stroke();
  }

  function drawRoundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
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
    ctx.bezierCurveTo(
      cx - s * 2,
      cy - s * 0.5,
      cx - s,
      cy - s * 2,
      cx,
      cy - s * 0.7,
    );
    ctx.bezierCurveTo(
      cx + s,
      cy - s * 2,
      cx + s * 2,
      cy - s * 0.5,
      cx,
      cy + s * 0.8,
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawPolygon(cx, cy, sides, radius) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = ((Math.PI * 2) / sides) * i - Math.PI / 2;
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
    const x = layout.cardX(card.col);
    const y = layout.cardY(card.row);
    const w = layout.cardW;
    const h = layout.cardH;
    const r = layout.cardRadius;
    const minSide = Math.min(w, h);

    const progress = card.flipProgress;
    const faceUp = progress >= 0.5;
    const scaleX = Math.max(0.02, Math.abs(progress * 2 - 1));
    const isSquished = scaleX < 0.999;

    if (isSquished) {
      ctx.save();
      ctx.translate(x + w / 2, 0);
      ctx.scale(scaleX, 1);
      ctx.translate(-(x + w / 2), 0);
    }

    if (faceUp) {
      drawRoundedRect(x, y, w, h, r);
      if (card.matched) {
        ctx.fillStyle = "#0a1a2a";
        ctx.fill();
        ctx.strokeStyle = card.color;
        ctx.lineWidth = clamp(minSide * 0.032, 2, 3.5);
        ctx.stroke();

        const cx = x + w / 2;
        const cy = y + h / 2;
        const shapeSize = (minSide * 0.52) / 2.4;
        ctx.save();
        ctx.shadowColor = card.color;
        ctx.shadowBlur = clamp(minSide * 0.1, 6, 16);
        drawShape(card.shape, cx, cy, shapeSize, card.color);
        ctx.restore();
      } else {
        ctx.fillStyle = ARNE.DARK_NAVY;
        ctx.fill();
        ctx.strokeStyle = ARNE.LIGHT_BLUE;
        ctx.lineWidth = clamp(minSide * 0.022, 1.5, 2.5);
        ctx.stroke();

        const labelBandH = clamp(Math.round(h * 0.21), 13, 24);
        const cardPad = clamp(Math.round(minSide * 0.08), 4, 10);
        const upperH = h - labelBandH - cardPad * 0.6;
        const cx = x + w / 2;
        const cy = y + cardPad * 0.5 + upperH / 2;
        const shapeSize = Math.max(
          4,
          Math.min((w - cardPad * 2) / 2, upperH / 2) / 1.32,
        );
        drawShape(card.shape, cx, cy, shapeSize, card.color);

        const labelY = y + h - labelBandH * 0.48;
        const labelMaxW = Math.max(12, w - cardPad * 2);
        const labelIdeal = clamp(minSide * 0.115, 8, 14);
        drawFittedText(card.shape.toUpperCase(), cx, labelY, labelMaxW, labelIdeal, {
          color: ARNE.GRAY,
          align: "center",
          baseline: "middle",
          minSize: 7,
          layer: "card",
          id: `card:${card.row},${card.col}`,
        });
      }
    } else {
      // Face down — cyberpunk pattern
      drawRoundedRect(x, y, w, h, r);
      ctx.fillStyle = ARNE.DARK_TEAL;
      ctx.fill();
      ctx.strokeStyle = ARNE.LIGHT_BLUE;
      ctx.lineWidth = clamp(minSide * 0.022, 1.5, 2.5);
      ctx.stroke();

      const cx = x + w / 2;
      const cy = y + h / 2;

      ctx.save();
      ctx.strokeStyle = ARNE.LIGHT_BLUE;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = clamp(minSide * 0.015, 1, 2);
      drawPolygon(cx, cy, 6, minSide * 0.28);
      ctx.stroke();

      const dH = minSide * 0.14;
      const dW = minSide * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - dH);
      ctx.lineTo(cx + dW, cy);
      ctx.lineTo(cx, cy + dH);
      ctx.lineTo(cx - dW, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      const inset = clamp(Math.round(minSide * 0.045), 3, 7);
      const accent = clamp(Math.round(minSide * 0.12), 7, 16);
      ctx.save();
      ctx.strokeStyle = ARNE.LIME;
      ctx.lineWidth = clamp(minSide * 0.02, 1.5, 2.5);
      ctx.globalAlpha = 0.7;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(x + inset, y + accent);
      ctx.lineTo(x + inset, y + inset);
      ctx.lineTo(x + accent, y + inset);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + w - accent, y + inset);
      ctx.lineTo(x + w - inset, y + inset);
      ctx.lineTo(x + w - inset, y + accent);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x + inset, y + h - accent);
      ctx.lineTo(x + inset, y + h - inset);
      ctx.lineTo(x + accent, y + h - inset);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + w - accent, y + h - inset);
      ctx.lineTo(x + w - inset, y + h - inset);
      ctx.lineTo(x + w - inset, y + h - accent);
      ctx.stroke();
      ctx.restore();
    }

    if (isSquished) {
      ctx.restore();
    }
  }

  // ── Draw HUD ────────────────────────────────────────────
  function getTimerBarColor(pct) {
    if (pct < 0.25) return ARNE.RED;
    if (pct < 0.5) return ARNE.ORANGE;
    if (pct < 0.75) return ARNE.YELLOW;
    return ARNE.LIGHT_BLUE;
  }

  function formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function drawTopHUD() {
    const { x, y, w, h } = layout.hudRect;
    const radius = clamp(Math.round(h * 0.16), 6, 12);

    drawRoundedRect(x, y, w, h, radius);
    ctx.fillStyle = "rgba(27, 38, 50, 0.68)";
    ctx.fill();
    ctx.strokeStyle = "rgba(49, 162, 242, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const padX = clamp(Math.round(w * 0.03), 8, 18);
    const padY = clamp(Math.round(h * 0.14), 6, 12);
    const barX = x + padX;
    const barW = w - padX * 2;
    const barH = clamp(Math.round(h * 0.16), 6, 10);
    const barY = y + padY;

    drawRoundedRect(barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = ARNE.DARK_NAVY;
    ctx.fill();

    const pct = Math.max(0, timer / TIME_LIMIT);
    if (pct > 0) {
      drawRoundedRect(barX, barY, Math.max(barH, barW * pct), barH, barH / 2);
      ctx.fillStyle = getTimerBarColor(pct);
      ctx.fill();
    }

    const rowTop = barY + barH + Math.max(4, Math.round(h * 0.08));
    const rowBot = y + h - padY * 0.5;
    const textY = (rowTop + rowBot) / 2;
    const found = cards.filter((c) => c.matched).length / 2;

    drawFittedText(`MISSES: ${misses}`, barX, textY, barW * 0.32, clamp(h * 0.25, 10, 16), {
      color: ARNE.RED,
      align: "left",
      baseline: "middle",
      minSize: 8,
      layer: "hud",
      id: "hud:misses",
    });

    drawFittedText(formatTime(timer), x + w / 2, textY, barW * 0.24, clamp(h * 0.34, 13, 22), {
      weight: "bold",
      color: ARNE.WHITE,
      align: "center",
      baseline: "middle",
      minSize: 10,
      layer: "hud",
      id: "hud:timer",
    });

    drawFittedText(`PAIRS: ${found}/${TOTAL_PAIRS}`, barX + barW, textY, barW * 0.32, clamp(h * 0.25, 10, 16), {
      color: ARNE.LIME,
      align: "right",
      baseline: "middle",
      minSize: 8,
      layer: "hud",
      id: "hud:pairs",
    });
  }

  function drawSideHUD() {
    const { x, y, w, h } = layout.hudRect;
    const radius = clamp(Math.round(Math.min(w, h) * 0.05), 8, 16);

    drawRoundedRect(x, y, w, h, radius);
    ctx.fillStyle = "rgba(27, 38, 50, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(49, 162, 242, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top accent bar
    const accentPad = clamp(Math.round(w * 0.08), 8, 16);
    ctx.fillStyle = ARNE.LIGHT_BLUE;
    ctx.fillRect(x + accentPad, y + 2, w - accentPad * 2, 2);

    const padX = clamp(Math.round(w * 0.08), 10, 22);
    const padY = clamp(Math.round(h * 0.04), 10, 22);
    const innerW = w - padX * 2;
    const cx = x + w / 2;
    const availH = h - padY * 2;

    const showFooter = h >= 460;
    const headerH = clamp(availH * 0.09, 18, 32);
    const footerH = showFooter ? clamp(availH * 0.09, 26, 44) : 0;
    const numGaps = showFooter ? 4 : 3;
    const gap = clamp(availH * 0.035, 6, 18);
    const blocksAvail = Math.max(120, availH - headerH - footerH - gap * numGaps);
    const timerBoxH = clamp(blocksAvail * 0.38, 58, 130);
    const statBoxH = clamp((blocksAvail - timerBoxH) / 2, 44, 110);

    const usedH = headerH + timerBoxH + statBoxH * 2 + footerH + gap * numGaps;
    let curY = y + padY + (showFooter ? 0 : Math.max(0, (availH - usedH) / 2));

    // Header
    drawFittedText("PRISM PANIC", cx, curY + headerH / 2, innerW, clamp(w * 0.105, 11, 20), {
      weight: "bold",
      color: ARNE.LIGHT_BLUE,
      align: "center",
      baseline: "middle",
      minSize: 9,
      layer: "hud",
      id: "hud:title",
    });
    curY += headerH + gap;

    // Timer Box
    drawRoundedRect(x + padX, curY, innerW, timerBoxH, 8);
    ctx.fillStyle = "rgba(10, 18, 28, 0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(49, 162, 242, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const boxInnerW = innerW - 16;
    drawFittedText("TIME", cx, curY + timerBoxH * 0.22, boxInnerW, clamp(timerBoxH * 0.18, 9, 13), {
      color: ARNE.GRAY,
      align: "center",
      baseline: "middle",
      minSize: 8,
      layer: "hud",
      id: "hud:time-label",
    });

    drawFittedText(
      formatTime(timer),
      cx,
      curY + timerBoxH * 0.54,
      boxInnerW,
      clamp(Math.min(boxInnerW * 0.28, timerBoxH * 0.34), 16, 34),
      {
        weight: "bold",
        color: ARNE.WHITE,
        align: "center",
        baseline: "middle",
        minSize: 12,
        layer: "hud",
        id: "hud:timer",
      },
    );

    const barW = Math.max(20, innerW - 20);
    const barH = clamp(Math.round(timerBoxH * 0.1), 5, 9);
    const barX = x + padX + 10;
    const barY = curY + timerBoxH * 0.82 - barH / 2;
    drawRoundedRect(barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = ARNE.DARK_NAVY;
    ctx.fill();

    const pct = Math.max(0, timer / TIME_LIMIT);
    if (pct > 0) {
      drawRoundedRect(barX, barY, Math.max(barH, barW * pct), barH, barH / 2);
      ctx.fillStyle = getTimerBarColor(pct);
      ctx.fill();
    }
    curY += timerBoxH + gap;

    // Pairs Stat Box
    const found = cards.filter((c) => c.matched).length / 2;
    drawRoundedRect(x + padX, curY, innerW, statBoxH, 8);
    ctx.fillStyle = "rgba(10, 18, 28, 0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(163, 206, 39, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    drawFittedText("PAIRS", cx, curY + statBoxH * 0.28, boxInnerW, clamp(statBoxH * 0.22, 9, 13), {
      color: ARNE.GRAY,
      align: "center",
      baseline: "middle",
      minSize: 8,
      layer: "hud",
      id: "hud:pairs-label",
    });
    drawFittedText(
      `${found}/${TOTAL_PAIRS}`,
      cx,
      curY + statBoxH * 0.68,
      boxInnerW,
      clamp(Math.min(boxInnerW * 0.24, statBoxH * 0.36), 14, 28),
      {
        weight: "bold",
        color: ARNE.LIME,
        align: "center",
        baseline: "middle",
        minSize: 11,
        layer: "hud",
        id: "hud:pairs",
      },
    );
    curY += statBoxH + gap;

    // Misses Stat Box
    drawRoundedRect(x + padX, curY, innerW, statBoxH, 8);
    ctx.fillStyle = "rgba(10, 18, 28, 0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(190, 38, 51, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    drawFittedText("MISSES", cx, curY + statBoxH * 0.28, boxInnerW, clamp(statBoxH * 0.22, 9, 13), {
      color: ARNE.GRAY,
      align: "center",
      baseline: "middle",
      minSize: 8,
      layer: "hud",
      id: "hud:misses-label",
    });
    drawFittedText(
      `${misses}`,
      cx,
      curY + statBoxH * 0.68,
      boxInnerW,
      clamp(Math.min(boxInnerW * 0.24, statBoxH * 0.36), 14, 28),
      {
        weight: "bold",
        color: ARNE.RED,
        align: "center",
        baseline: "middle",
        minSize: 11,
        layer: "hud",
        id: "hud:misses",
      },
    );

    if (showFooter) {
      const footerY = y + h - padY - footerH / 2;
      drawFittedText("ARROWS + ENTER / TAP", cx, footerY, innerW, clamp(w * 0.058, 9, 12), {
        color: ARNE.GRAY,
        align: "center",
        baseline: "middle",
        minSize: 8,
        layer: "hud",
        id: "hud:hint",
      });
    }
  }

  function drawHUD() {
    if (layout.hudMode === "side") {
      drawSideHUD();
    } else {
      drawTopHUD();
    }
  }

  // ── Draw Selector Cursor ────────────────────────────────
  function drawSelector() {
    if (gState !== STATE.PLAYING) return;
    const x = layout.cardX(selectCol);
    const y = layout.cardY(selectRow);
    const w = layout.cardW;
    const h = layout.cardH;
    const minSide = Math.min(w, h);

    const pad = clamp(layout.cardGap * 0.35, 2, 5);
    const bracketLen = clamp(minSide * 0.2, 8, 18);
    const amp = clamp(layout.cardGap * 0.16, 1, 2.5);
    const offset = Math.sin(performance.now() / 300) * amp;

    ctx.save();
    ctx.strokeStyle = ARNE.LIME;
    ctx.lineWidth = clamp(minSide * 0.03, 2, 3.5);
    ctx.shadowColor = ARNE.LIME;
    ctx.shadowBlur = clamp(minSide * 0.08, 4, 10);

    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(x - pad + offset, y + bracketLen);
    ctx.lineTo(x - pad + offset, y - pad);
    ctx.lineTo(x + bracketLen, y - pad);
    ctx.stroke();

    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y - pad);
    ctx.lineTo(x + w + pad - offset, y - pad);
    ctx.lineTo(x + w + pad - offset, y + bracketLen);
    ctx.stroke();

    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(x - pad + offset, y + h - bracketLen);
    ctx.lineTo(x - pad + offset, y + h + pad);
    ctx.lineTo(x + bracketLen, y + h + pad);
    ctx.stroke();

    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y + h + pad);
    ctx.lineTo(x + w + pad - offset, y + h + pad);
    ctx.lineTo(x + w + pad - offset, y + h - bracketLen);
    ctx.stroke();

    ctx.restore();
  }

  // ── Title Screen ────────────────────────────────────────
  let titlePulse = 0;
  function drawTitleScreen(dt) {
    titlePulse += dt * 0.003;
    drawBackground();

    const inner = layout.innerRect;
    const maxContentW = Math.min(inner.w, 920);
    const cx = inner.x + inner.w / 2;

    const footerFont = clamp(Math.min(inner.w, inner.h) * 0.022, 9, 13);
    const footerY = inner.y + inner.h - Math.max(6, Math.round(footerFont * 0.6));
    const availH = Math.max(150, footerY - footerFont * 0.9 - inner.y - 8);

    const twoRows = maxContentW < 460;
    const singleControlLine = inner.h < 400 && maxContentW >= 440;

    let titleSize = clamp(Math.min(maxContentW * 0.095, availH * 0.13), 26, 72);
    let subSize = clamp(Math.min(maxContentW * 0.026, availH * 0.042), 10, 20);
    let shapeSize = twoRows
      ? clamp(Math.min(maxContentW * 0.055, availH * 0.055), 11, 24)
      : clamp(Math.min(maxContentW / 24, availH * 0.065), 12, 30);
    let promptSize = clamp(Math.min(maxContentW * 0.036, availH * 0.055), 12, 26);
    let ctrlSize = clamp(Math.min(maxContentW * 0.023, availH * 0.038), 10, 16);

    let gap1 = clamp(availH * 0.035, 6, 22);
    let gap2 = clamp(availH * 0.08, 10, 48);
    let gap3 = clamp(availH * 0.08, 10, 48);
    let gap4 = clamp(availH * 0.055, 8, 32);
    let ctrlGap = clamp(availH * 0.025, 4, 14);
    let rowGap = shapeSize * 2.8;

    const computeShapesH = () =>
      twoRows ? shapeSize * 2.4 + rowGap : shapeSize * 2.4;
    const computeCtrlsH = () =>
      singleControlLine ? ctrlSize : ctrlSize * 2 + ctrlGap;
    const computeTotalH = () =>
      titleSize +
      gap1 +
      subSize +
      gap2 +
      computeShapesH() +
      gap3 +
      promptSize +
      gap4 +
      computeCtrlsH();

    let totalH = computeTotalH();
    if (totalH > availH) {
      const k = availH / totalH;
      titleSize = Math.max(20, titleSize * k);
      subSize = Math.max(9, subSize * k);
      shapeSize = Math.max(9, shapeSize * k);
      rowGap = shapeSize * 2.6;
      promptSize = Math.max(11, promptSize * k);
      ctrlSize = Math.max(9, ctrlSize * k);
      gap1 = Math.max(4, gap1 * k);
      gap2 = Math.max(6, gap2 * k);
      gap3 = Math.max(6, gap3 * k);
      gap4 = Math.max(5, gap4 * k);
      ctrlGap = Math.max(3, ctrlGap * k);
      totalH = computeTotalH();
    }

    let curY = inner.y + Math.max(0, (availH - totalH) / 2);

    // Title
    drawFittedText("PRISM PANIC", cx, curY + titleSize / 2, maxContentW, titleSize, {
      weight: "bold",
      color: ARNE.LIGHT_BLUE,
      align: "center",
      baseline: "middle",
      minSize: 16,
      shadowColor: ARNE.LIGHT_BLUE,
      shadowBlur: 18 + Math.sin(titlePulse) * 8,
      layer: "title",
      id: "title:main",
    });
    curY += titleSize + gap1;

    // Subtitle
    drawFittedText(
      "MEMORY MATCH // CYBERPUNK EDITION",
      cx,
      curY + subSize / 2,
      maxContentW,
      subSize,
      {
        color: ARNE.LIME,
        align: "center",
        baseline: "middle",
        minSize: 9,
        layer: "title",
        id: "title:sub",
      },
    );
    curY += subSize + gap2;

    // Decorative shapes
    if (twoRows) {
      const cols = 4;
      const spanW = Math.min(maxContentW, shapeSize * 14);
      const stepX = spanW / cols;
      const startX = cx - spanW / 2 + stepX / 2;
      const row1Y = curY + shapeSize * 1.2;
      const row2Y = row1Y + rowGap;
      for (let i = 0; i < SHAPES.length; i++) {
        const col = i % cols;
        const r = Math.floor(i / cols);
        drawShape(
          SHAPES[i],
          startX + col * stepX,
          r === 0 ? row1Y : row2Y,
          shapeSize,
          PAIR_COLORS[i],
        );
      }
      curY += computeShapesH() + gap3;
    } else {
      const spanW = Math.min(maxContentW, shapeSize * 26);
      const stepX = spanW / SHAPES.length;
      const startX = cx - spanW / 2 + stepX / 2;
      const rowY = curY + shapeSize * 1.2;
      for (let i = 0; i < SHAPES.length; i++) {
        drawShape(SHAPES[i], startX + i * stepX, rowY, shapeSize, PAIR_COLORS[i]);
      }
      curY += computeShapesH() + gap3;
    }

    // Start prompt
    const alpha = 0.725 + 0.275 * Math.sin(titlePulse * 2);
    drawFittedText(
      "[ PRESS ANY KEY / TAP TO START ]",
      cx,
      curY + promptSize / 2,
      maxContentW,
      promptSize,
      {
        weight: "bold",
        color: ARNE.WHITE,
        align: "center",
        baseline: "middle",
        minSize: 10,
        alpha,
        layer: "title",
        id: "title:prompt",
      },
    );
    curY += promptSize + gap4;

    // Controls info
    if (singleControlLine) {
      drawFittedText(
        "MOUSE/TAP: CLICK CARD TO FLIP  //  KEYBOARD: ARROWS + ENTER",
        cx,
        curY + ctrlSize / 2,
        maxContentW,
        ctrlSize,
        {
          color: ARNE.GRAY,
          align: "center",
          baseline: "middle",
          minSize: 8,
          layer: "title",
          id: "title:controls",
        },
      );
    } else {
      drawFittedText(
        "MOUSE: CLICK CARD TO FLIP",
        cx,
        curY + ctrlSize / 2,
        maxContentW,
        ctrlSize,
        {
          color: ARNE.GRAY,
          align: "center",
          baseline: "middle",
          minSize: 8,
          layer: "title",
          id: "title:controls1",
        },
      );
      drawFittedText(
        "KEYBOARD: ARROW KEYS + ENTER",
        cx,
        curY + ctrlSize + ctrlGap + ctrlSize / 2,
        maxContentW,
        ctrlSize,
        {
          color: ARNE.GRAY,
          align: "center",
          baseline: "middle",
          minSize: 8,
          layer: "title",
          id: "title:controls2",
        },
      );
    }

    // Version footer
    drawFittedText(
      "v1.0 // ARNE16 PALETTE",
      cx,
      footerY,
      maxContentW,
      footerFont,
      {
        color: ARNE.DARK_TEAL,
        align: "center",
        baseline: "middle",
        minSize: 8,
        layer: "title",
        id: "title:version",
      },
    );
  }

  // ── Preview Screen ──────────────────────────────────────
  function drawPreviewScreen() {
    drawBackground();
    drawHUD();

    for (const card of cards) {
      drawCard(card);
    }

    const b = layout.boardRect;
    const veilAlpha = 0.22 + 0.12 * Math.sin(performance.now() / 200);
    ctx.fillStyle = `rgba(0, 0, 0, ${veilAlpha})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    const remaining = Math.max(0, previewEnd - performance.now());
    const count = Math.ceil(remaining / 1000);

    const badgeW = clamp(b.w * 0.72, Math.min(b.w - 12, 160), Math.min(b.w - 12, 360));
    const badgeH = clamp(b.h * 0.28, Math.min(b.h - 12, 74), Math.min(b.h - 12, 148));
    const badgeX = b.x + (b.w - badgeW) / 2;
    const badgeY = b.y + (b.h - badgeH) / 2;
    lastOverlayRect = { x: badgeX, y: badgeY, w: badgeW, h: badgeH };

    drawRoundedRect(badgeX, badgeY, badgeW, badgeH, clamp(badgeH * 0.14, 8, 16));
    ctx.fillStyle = "rgba(10, 18, 28, 0.94)";
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = ARNE.LIGHT_BLUE;
    ctx.lineWidth = 2;
    ctx.shadowColor = ARNE.LIGHT_BLUE;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    const maxTextW = Math.max(40, badgeW - 20);
    const cx = badgeX + badgeW / 2;
    drawFittedText(
      count.toString(),
      cx,
      badgeY + badgeH * 0.37,
      maxTextW,
      clamp(badgeH * 0.42, 22, 54),
      {
        weight: "bold",
        color: ARNE.LIGHT_BLUE,
        align: "center",
        baseline: "middle",
        minSize: 16,
        layer: "overlay",
        id: "preview:count",
      },
    );

    drawFittedText(
      "MEMORIZE THE CARDS",
      cx,
      badgeY + badgeH * 0.77,
      maxTextW,
      clamp(badgeH * 0.145, 10, 17),
      {
        color: ARNE.LIGHT_CYAN,
        align: "center",
        baseline: "middle",
        minSize: 8,
        layer: "overlay",
        id: "preview:label",
      },
    );
  }

  // ── Game Screen ─────────────────────────────────────────
  function drawGameScreen() {
    drawBackground();
    drawHUD();

    for (const card of cards) {
      drawCard(card);
    }

    drawSelector();
    drawParticles();
  }

  // ── Win & Lose Modal Screen ─────────────────────────────
  function drawEndScreen(isWin) {
    drawBackground();

    for (const card of cards) {
      drawCard(card);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, layout.vw, layout.vh);

    const inner = layout.innerRect;
    const compact = inner.h < 420;
    const modalW = clamp(
      inner.w * 0.86,
      Math.min(inner.w, 260),
      Math.min(inner.w, 540),
    );
    const modalH = clamp(
      inner.h * (compact ? 0.84 : 0.64),
      Math.min(inner.h, 210),
      Math.min(inner.h, 440),
    );
    const modalX = inner.x + (inner.w - modalW) / 2;
    const modalY = inner.y + (inner.h - modalH) / 2;
    lastModalRect = { x: modalX, y: modalY, w: modalW, h: modalH };

    const accent = isWin ? ARNE.LIME : ARNE.RED;
    drawRoundedRect(modalX, modalY, modalW, modalH, clamp(Math.min(modalW, modalH) * 0.06, 10, 18));
    ctx.fillStyle = "rgba(11, 18, 28, 0.94)";
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();

    const padX = clamp(modalW * 0.07, 14, 32);
    const padY = clamp(modalH * 0.08, 12, 28);
    const maxTextW = Math.max(80, modalW - padX * 2);
    const availH = Math.max(100, modalH - padY * 2);
    const cx = modalX + modalW / 2;

    const matched = cards.filter((c) => c.matched).length / 2;
    const rows = [];

    if (compact) {
      rows.push({
        id: "modal:title",
        text: isWin ? "SYSTEM UNLOCKED" : "SYSTEM LOCKED",
        size: clamp(modalW * 0.085, 18, 34),
        weight: "bold",
        color: accent,
        shadowColor: accent,
        shadowBlur: 12,
        gapAfter: clamp(availH * 0.08, 8, 18),
      });
    } else {
      const tSize = clamp(Math.min(modalW * 0.105, modalH * 0.125), 22, 46);
      rows.push({
        id: "modal:title1",
        text: "SYSTEM",
        size: tSize,
        weight: "bold",
        color: accent,
        shadowColor: accent,
        shadowBlur: 12,
        gapAfter: clamp(availH * 0.025, 4, 10),
      });
      rows.push({
        id: "modal:title2",
        text: isWin ? "UNLOCKED" : "LOCKED",
        size: tSize,
        weight: "bold",
        color: accent,
        shadowColor: accent,
        shadowBlur: 12,
        gapAfter: clamp(availH * 0.08, 10, 26),
      });
    }

    if (isWin) {
      rows.push({
        id: "modal:score",
        text: `SCORE: ${score}`,
        size: clamp(Math.min(modalW * 0.08, modalH * 0.1), 16, 34),
        weight: "bold",
        color: ARNE.YELLOW,
        gapAfter: clamp(availH * 0.05, 6, 18),
      });
      if (compact) {
        rows.push({
          id: "modal:stats",
          text: `TIME LEFT: ${Math.floor(timer)}s  |  MISSES: ${misses}`,
          size: clamp(modalH * 0.075, 11, 16),
          weight: "normal",
          color: ARNE.GRAY,
          gapAfter: clamp(availH * 0.09, 10, 24),
        });
      } else {
        rows.push({
          id: "modal:time",
          text: `TIME REMAINING: ${Math.floor(timer)}s`,
          size: clamp(modalH * 0.055, 12, 18),
          weight: "normal",
          color: ARNE.GRAY,
          gapAfter: clamp(availH * 0.025, 4, 10),
        });
        rows.push({
          id: "modal:misses",
          text: `MISSES: ${misses}`,
          size: clamp(modalH * 0.055, 12, 18),
          weight: "normal",
          color: ARNE.GRAY,
          gapAfter: clamp(availH * 0.08, 10, 28),
        });
      }
    } else {
      rows.push({
        id: "modal:pairs",
        text: `PAIRS FOUND: ${matched}/${TOTAL_PAIRS}`,
        size: clamp(Math.min(modalW * 0.065, modalH * 0.08), 14, 24),
        weight: "bold",
        color: ARNE.LIGHT_CYAN,
        gapAfter: clamp(availH * 0.04, 6, 14),
      });
      rows.push({
        id: "modal:misses",
        text: `MISSES: ${misses}`,
        size: clamp(modalH * 0.06, 12, 18),
        weight: "normal",
        color: ARNE.GRAY,
        gapAfter: clamp(availH * 0.09, 10, 28),
      });
    }

    const alpha = 0.725 + 0.275 * Math.sin(performance.now() / 300);
    rows.push({
      id: "modal:prompt",
      text: isWin
        ? "[ PRESS ANY KEY / TAP TO PLAY AGAIN ]"
        : "[ PRESS ANY KEY / TAP TO TRY AGAIN ]",
      size: clamp(modalW * 0.042, 11, 20),
      weight: "bold",
      color: ARNE.WHITE,
      alpha,
      gapAfter: 0,
    });

    const totalH = rows.reduce((acc, r) => acc + r.size + r.gapAfter, 0);
    const k = totalH > availH ? availH / totalH : 1;
    let curY = modalY + padY + Math.max(0, (availH - totalH * k) / 2);

    for (const row of rows) {
      const sz = Math.max(9, row.size * k);
      drawFittedText(row.text, cx, curY + sz / 2, maxTextW, sz, {
        weight: row.weight,
        color: row.color,
        align: "center",
        baseline: "middle",
        minSize: 8,
        shadowColor: row.shadowColor || null,
        shadowBlur: row.shadowBlur || 0,
        alpha: row.alpha !== undefined ? row.alpha : 1,
        layer: "modal",
        id: row.id,
      });
      curY += sz + row.gapAfter * k;
    }
  }

  // ── Update Flip Animations ──────────────────────────────
  function updateFlips(dt) {
    const step = 1 - Math.pow(0.8, Math.min(dt, 50) / 16.67);
    for (const card of cards) {
      if (card._flipTarget !== undefined) {
        const diff = card._flipTarget - card.flipProgress;
        if (Math.abs(diff) > 0.005) {
          card.flipProgress += diff * step;
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
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const sx = ((px - rect.left) / rect.width) * layout.vw;
    const sy = ((py - rect.top) / rect.height) * layout.vh;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cx = layout.cardX(c);
        const cy = layout.cardY(r);
        if (
          sx >= cx &&
          sx <= cx + layout.cardW &&
          sy >= cy &&
          sy <= cy + layout.cardH
        ) {
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
    }
  }

  // Mouse
  canvas.addEventListener("click", (e) => {
    const hit = getCardAt(e.clientX, e.clientY);
    if (hit) {
      handleInput(hit.row, hit.col);
    } else if (
      gState === STATE.TITLE ||
      gState === STATE.WIN ||
      gState === STATE.LOSE
    ) {
      startGame();
    }
  });

  // Touch
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const hit = getCardAt(touch.clientX, touch.clientY);
      if (hit) {
        handleInput(hit.row, hit.col);
      } else if (
        gState === STATE.TITLE ||
        gState === STATE.WIN ||
        gState === STATE.LOSE
      ) {
        startGame();
      }
    },
    { passive: false },
  );

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (
      gState === STATE.TITLE ||
      gState === STATE.WIN ||
      gState === STATE.LOSE
    ) {
      if (MODIFIER_KEYS.has(e.key)) return;
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
    const rawDt = now - lastTime;
    const dt = Math.max(0, rawDt);
    const visualDt = Math.min(dt, 50);
    lastTime = now;

    // Frame guard for late-settling viewport/DPR changes
    const cur = getViewportSize();
    const dpr = window.devicePixelRatio || 1;
    if (
      !layout ||
      cur.vw !== layout.vw ||
      cur.vh !== layout.vh ||
      dpr !== layout.dpr
    ) {
      resize();
    }

    // Update timer
    if (gState === STATE.PLAYING || gState === STATE.PREVIEW) {
      timerAccum += dt;
      if (timerAccum >= 1000) {
        const elapsed = Math.floor(timerAccum / 1000);
        timerAccum -= elapsed * 1000;
        timer = Math.max(0, timer - elapsed);
        if (timer <= 0) {
          timer = 0;
          gState = STATE.LOSE;
        }
      }
    }

    // End preview
    if (gState === STATE.PREVIEW && now >= previewEnd) {
      gState = STATE.PLAYING;
      for (const card of cards) {
        card.flipped = false;
        card.flipProgress = 0;
        card._flipTarget = undefined;
        card.matched = false;
      }
    }

    // Update flips & particles
    updateFlips(visualDt);
    updateParticles(visualDt);

    // Draw
    frameTextBoxes = [];
    lastOverlayRect = null;
    lastModalRect = null;

    switch (gState) {
      case STATE.TITLE:
        drawTitleScreen(visualDt);
        break;
      case STATE.PREVIEW:
        drawPreviewScreen();
        break;
      case STATE.PLAYING:
        drawGameScreen();
        break;
      case STATE.WIN:
        drawEndScreen(true);
        break;
      case STATE.LOSE:
        drawEndScreen(false);
        break;
    }

    lastFrameTextBoxes = frameTextBoxes;
    requestAnimationFrame(gameLoop);
  }

  // ── Read-Only Verification Hook ─────────────────────────
  window.__PRISM_DEBUG__ = {
    getSnapshot() {
      const rect = canvas.getBoundingClientRect();
      return {
        state: gState,
        timer,
        misses,
        score,
        selectRow,
        selectCol,
        layout: layout
          ? {
              vw: layout.vw,
              vh: layout.vh,
              dpr: layout.dpr,
              orientation: layout.orientation,
              hudMode: layout.hudMode,
              cardW: layout.cardW,
              cardH: layout.cardH,
              cardGap: layout.cardGap,
              cardRadius: layout.cardRadius,
              safeRect: { ...layout.safeRect },
              innerRect: { ...layout.innerRect },
              hudRect: { ...layout.hudRect },
              boardRect: { ...layout.boardRect },
            }
          : null,
        cards: cards.map((c) => ({
          row: c.row,
          col: c.col,
          shape: c.shape,
          color: c.color,
          matched: c.matched,
          flipped: c.flipped,
          flipProgress: c.flipProgress,
          rect: layout
            ? {
                x: layout.cardX(c.col),
                y: layout.cardY(c.row),
                w: layout.cardW,
                h: layout.cardH,
              }
            : null,
        })),
        textBoxes: lastFrameTextBoxes.slice(),
        overlayRect: lastOverlayRect ? { ...lastOverlayRect } : null,
        modalRect: lastModalRect ? { ...lastModalRect } : null,
        canvasCss: {
          width: rect.width,
          height: rect.height,
        },
        canvasBacking: {
          width: canvas.width,
          height: canvas.height,
        },
        dpr: window.devicePixelRatio || 1,
      };
    },
  };

  // ── Start ───────────────────────────────────────────────
  requestAnimationFrame(gameLoop);
})();
