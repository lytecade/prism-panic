// Prism Panic - Cyberpunk Memory Match Game
// No external dependencies - pure HTML5 Canvas + JavaScript

(function () {
    "use strict";

    // ─── Arne16 Color Palette ────────────────────────────────────
    const C = {
        black:      "#000000",
        gray:       "#9D9D9D",
        white:      "#FFFFFF",
        crimson:    "#BE2633",
        pink:       "#E06F8B",
        brown:      "#493C2B",
        bronze:     "#A46422",
        orange:     "#EB8931",
        gold:       "#F7E26B",
        slate:      "#2F484E",
        forest:     "#44891A",
        lime:       "#A3CE27",
        navy:       "#1B2632",
        ocean:      "#005784",
        sky:        "#31A2F2",
        ice:        "#B2DCFF"
    };

    // Card colors (8 vibrant ones from the palette)
    const CARD_COLORS = [C.crimson, C.orange, C.gold, C.lime, C.sky, C.pink, C.bronze, C.forest];

    // Shape names
    const SHAPES = ["Circle", "Square", "Triangle", "Star", "Heart", "Diamond", "Pentagon", "Hexagon"];

    // Total pairs count
    const TOTAL_PAIRS = SHAPES.length; // 8

    // ─── Game Constants ──────────────────────────────────────────
    const INTERNAL_W = 640;
    const INTERNAL_H = 640;
    const TOTAL_TIME = 300; // 5 minutes
    const PREVIEW_TIME = 3; // 3 seconds
    const FLIP_DURATION = 300; // ms for flip animation

    // Grid layout for cards
    const COLS = 4;
    const ROWS = 4;

    // ─── Game States ─────────────────────────────────────────────
    const STATE = {
        TITLE: "title",
        PREVIEW: "preview",
        PLAYING: "playing",
        WIN: "win",
        LOSE: "lose"
    };

    // ─── Canvas Setup ────────────────────────────────────────────
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = INTERNAL_W;
    canvas.height = INTERNAL_H;

    // ─── Game State ──────────────────────────────────────────────
    let gameState = STATE.TITLE;
    let cards = [];
    let flippedCards = []; // cards currently face-up (during comparison)
    let matchedPairs = 0;
    let misses = 0;
    let timer = TOTAL_TIME;
    let lastTime = 0;
    let previewTimer = PREVIEW_TIME;
    let selectorRow = 0;
    let selectorCol = 0;
    let titlePulse = 0;
    let scanlineOffset = 0;
    let particles = [];
    let flipAnimations = []; // {cardIndex, progress, direction, callback}
    let canInteract = true;
    let shakeTimer = 0;
    let shakeIntensity = 0;
    let winGlow = 0;
    let loseGlow = 0;
    let previewFlash = 0;
    let matchFlashCards = [];
    let matchFlashTimer = 0;

    // ─── Resize Handler ──────────────────────────────────────────
    function resize() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const scale = Math.min(winW / INTERNAL_W, winH / INTERNAL_H);
        canvas.style.width = (INTERNAL_W * scale) + "px";
        canvas.style.height = (INTERNAL_H * scale) + "px";
    }
    window.addEventListener("resize", resize);
    resize();

    // ─── Utility Functions ───────────────────────────────────────
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ─── Card Geometry ──────────────────────────────────────────
    function getCardLayout() {
        const margin = 40;
        const topBar = 55;
        const bottomMargin = 30;
        const availW = INTERNAL_W - margin * 2;
        const availH = INTERNAL_H - topBar - bottomMargin - margin;
        const cardGap = 12;
        const cardW = Math.min((availW - cardGap * (COLS - 1)) / COLS, availH / ROWS - cardGap * (ROWS - 1) / ROWS);
        const cardH = cardW; // square cards
        const gridW = cardW * COLS + cardGap * (COLS - 1);
        const gridH = cardH * ROWS + cardGap * (ROWS - 1);
        const startX = (INTERNAL_W - gridW) / 2;
        const startY = topBar + (availH - gridH) / 2;
        const radius = cardW * 0.1;

        return { cardW, cardH, startX, startY, cardGap, topBar, radius };
    }

    function getCardPos(row, col, layout) {
        return {
            x: layout.startX + col * (layout.cardW + layout.cardGap),
            y: layout.startY + row * (layout.cardH + layout.cardGap)
        };
    }

    // ─── Card Creation ──────────────────────────────────────────
    function createCards() {
        cards = [];
        // Create pairs: each shape gets one color
        for (let i = 0; i < SHAPES.length; i++) {
            cards.push({ shape: SHAPES[i], color: CARD_COLORS[i], matched: false, faceUp: false });
            cards.push({ shape: SHAPES[i], color: CARD_COLORS[i], matched: false, faceUp: false });
        }
        shuffle(cards);
    }

    // ─── Drawing Functions ───────────────────────────────────────

    function drawBackground() {
        // Dark gradient background
        const grad = ctx.createRadialGradient(
            INTERNAL_W / 2, INTERNAL_H / 2, 0,
            INTERNAL_W / 2, INTERNAL_H / 2, INTERNAL_W * 0.7
        );
        grad.addColorStop(0, C.navy);
        grad.addColorStop(1, C.black);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

        // Grid lines
        ctx.strokeStyle = C.ocean;
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < INTERNAL_W; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, INTERNAL_H);
            ctx.stroke();
        }
        for (let y = 0; y < INTERNAL_H; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(INTERNAL_W, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawScanlines() {
        scanlineOffset = (scanlineOffset + 0.5) % 4;
        ctx.fillStyle = C.black;
        ctx.globalAlpha = 0.08;
        for (let y = scanlineOffset; y < INTERNAL_H; y += 4) {
            ctx.fillRect(0, y, INTERNAL_W, 1);
        }
        ctx.globalAlpha = 1;
    }

    function drawCardShape(cx, cy, size, shape, color) {
        const s = size * 0.55;
        ctx.save();

        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";

        switch (shape) {
            case "Circle":
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
                ctx.fill();
                break;

            case "Square":
                ctx.beginPath();
                ctx.rect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8);
                ctx.fill();
                break;

            case "Triangle":
                ctx.beginPath();
                ctx.moveTo(cx, cy - s * 0.45);
                ctx.lineTo(cx + s * 0.45, cy + s * 0.35);
                ctx.lineTo(cx - s * 0.45, cy + s * 0.35);
                ctx.closePath();
                ctx.fill();
                break;

            case "Star":
                drawStar(cx, cy, 5, s * 0.48, s * 0.22);
                break;

            case "Heart":
                drawHeart(cx, cy, s * 0.45);
                break;

            case "Diamond":
                ctx.beginPath();
                ctx.moveTo(cx, cy - s * 0.48);
                ctx.lineTo(cx + s * 0.35, cy);
                ctx.lineTo(cx, cy + s * 0.48);
                ctx.lineTo(cx - s * 0.35, cy);
                ctx.closePath();
                ctx.fill();
                break;

            case "Pentagon":
                drawPolygon(cx, cy, 5, s * 0.45);
                break;

            case "Hexagon":
                drawPolygon(cx, cy, 6, s * 0.45);
                break;
        }

        ctx.restore();
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

    function drawStar(cx, cy, spikes, outerR, innerR) {
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI / spikes) * i - Math.PI / 2;
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
        const s = size * 0.6;
        ctx.moveTo(cx, cy + s * 0.7);
        ctx.bezierCurveTo(cx - s * 1.2, cy + s * 0.1, cx - s * 1.2, cy - s * 0.6, cx, cy - s * 0.2);
        ctx.bezierCurveTo(cx + s * 1.2, cy - s * 0.6, cx + s * 1.2, cy + s * 0.1, cx, cy + s * 0.7);
        ctx.closePath();
        ctx.fill();
    }

    function drawCardBack(cx, cy, w, h, radius) {
        // Card back pattern - cyberpunk circuit design
        ctx.fillStyle = C.slate;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.fill();

        // Border
        ctx.strokeStyle = C.ocean;
        ctx.lineWidth = 2;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.stroke();

        // Circuit pattern
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = C.sky;
        ctx.lineWidth = 1.5;

        // Center diamond
        const ds = w * 0.15;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ds);
        ctx.lineTo(cx + ds * 0.7, cy);
        ctx.lineTo(cx, cy + ds);
        ctx.lineTo(cx - ds * 0.7, cy);
        ctx.closePath();
        ctx.stroke();

        // Lines from center
        const ext = w * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - ds);
        ctx.lineTo(cx, cy - ds - ext);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + ds);
        ctx.lineTo(cx, cy + ds + ext);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - ds * 0.7, cy);
        ctx.lineTo(cx - ds * 0.7 - ext, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + ds * 0.7, cy);
        ctx.lineTo(cx + ds * 0.7 + ext, cy);
        ctx.stroke();

        // Corner dots
        const dotR = 3;
        ctx.fillStyle = C.sky;
        [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(cx + dx * (w*0.35), cy + dy * (h*0.35), dotR, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        // "PRISM" text
        ctx.save();
        ctx.fillStyle = C.ice;
        ctx.globalAlpha = 0.3;
        ctx.font = `bold ${Math.floor(w * 0.09)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PRISM", cx, cy);
        ctx.restore();
    }

    function drawCardFront(cx, cy, w, h, radius, shape, color) {
        // Card face
        const grad = ctx.createLinearGradient(cx - w/2, cy - h/2, cx + w/2, cy + h/2);
        grad.addColorStop(0, C.navy);
        grad.addColorStop(1, "#0D1B2A");
        ctx.fillStyle = grad;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.fill();

        // Glowing border
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.stroke();
        ctx.restore();

        // Shape
        drawCardShape(cx, cy, w, shape, color);
    }

    function drawMatchedCard(cx, cy, w, h, radius, shape, color) {
        // Subtle dim for matched cards
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawCardFront(cx, cy, w, h, radius, shape, color);
        ctx.restore();

        // Checkmark
        ctx.save();
        ctx.strokeStyle = C.lime;
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const ms = w * 0.1;
        ctx.beginPath();
        ctx.moveTo(cx - ms * 0.8, cy);
        ctx.lineTo(cx - ms * 0.1, cy + ms * 0.6);
        ctx.lineTo(cx + ms * 1.0, cy - ms * 0.8);
        ctx.stroke();
        ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
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

    function drawHUD(layout) {
        const y = layout.topBar;

        // Timer
        ctx.save();
        const mins = Math.floor(timer / 60);
        const secs = Math.floor(timer % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

        ctx.font = "bold 28px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        if (timer <= 30) {
            // Red pulse when time is low
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
            ctx.shadowColor = C.crimson;
            ctx.shadowBlur = 10;
            ctx.fillStyle = C.crimson;
        } else {
            ctx.shadowColor = C.ice;
            ctx.shadowBlur = 5;
            ctx.fillStyle = C.ice;
        }

        ctx.fillText(`⏱ ${timeStr}`, 16, 10);
        ctx.restore();

        // Misses
        ctx.save();
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = C.orange;
        ctx.shadowBlur = 4;
        ctx.fillStyle = C.orange;
        ctx.fillText(`✗ ${misses}`, INTERNAL_W / 2, 8);
        ctx.restore();

        // Pairs
        ctx.save();
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 4;
        ctx.fillStyle = C.lime;
        ctx.fillText(`${matchedPairs}/${TOTAL_PAIRS}`, INTERNAL_W - 16, 8);
        ctx.restore();
    }

    function drawSelector(layout) {
        const pos = getCardPos(selectorRow, selectorCol, layout);
        const cx = pos.x;
        const cy = pos.y;
        const w = layout.cardW;
        const h = layout.cardH;
        const r = layout.radius + 4;

        ctx.save();
        const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.shadowColor = C.ice;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = C.ice;
        ctx.lineWidth = 3;
        roundRect(cx - w/2 - 3, cy - h/2 - 3, w + 6, h + 6, r);
        ctx.stroke();
        ctx.restore();
    }

    // ─── Particles ───────────────────────────────────────────────
    function spawnMatchParticles(cx, cy, color) {
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i + Math.random() * 0.3;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.015 + Math.random() * 0.02,
                color: color,
                size: 2 + Math.random() * 3
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravity
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    // ─── Title Screen ────────────────────────────────────────────
    function drawTitleScreen(dt) {
        titlePulse += dt * 2;

        drawBackground();
        drawScanlines();

        const cx = INTERNAL_W / 2;
        const cy = INTERNAL_H / 2 - 40;

        // Decorative corner elements
        ctx.save();
        ctx.strokeStyle = C.sky;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        const cs = 50;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(30, 30 + cs);
        ctx.lineTo(30, 30);
        ctx.lineTo(30 + cs, 30);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(INTERNAL_W - 30 - cs, 30);
        ctx.lineTo(INTERNAL_W - 30, 30);
        ctx.lineTo(INTERNAL_W - 30, 30 + cs);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(30, INTERNAL_H - 30 - cs);
        ctx.lineTo(30, INTERNAL_H - 30);
        ctx.lineTo(30 + cs, INTERNAL_H - 30);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(INTERNAL_W - 30 - cs, INTERNAL_H - 30);
        ctx.lineTo(INTERNAL_W - 30, INTERNAL_H - 30);
        ctx.lineTo(INTERNAL_W - 30, INTERNAL_H - 30 - cs);
        ctx.stroke();
        ctx.restore();

        // PRISM text with neon glow
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Glow layers
        const glowIntensity = Math.sin(titlePulse) * 0.3 + 0.7;
        ctx.shadowColor = C.sky;
        ctx.shadowBlur = 20 + glowIntensity * 15;
        ctx.font = "bold 72px monospace";
        ctx.fillStyle = C.ice;
        ctx.globalAlpha = 0.5 + glowIntensity * 0.5;
        ctx.fillText("PRISM", cx, cy - 45);

        ctx.shadowBlur = 10;
        ctx.globalAlpha = 1;
        ctx.fillText("PRISM", cx, cy - 45);

        // PANIC text
        ctx.shadowColor = C.crimson;
        ctx.shadowBlur = 15 + glowIntensity * 10;
        ctx.fillStyle = C.crimson;
        ctx.globalAlpha = 0.5 + glowIntensity * 0.5;
        ctx.fillText("PANIC", cx, cy + 30);

        ctx.shadowBlur = 8;
        ctx.globalAlpha = 1;
        ctx.fillText("PANIC", cx, cy + 30);

        ctx.restore();

        // Subtitle
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "16px monospace";
        ctx.fillStyle = C.gray;
        ctx.globalAlpha = 0.7;
        ctx.fillText("▸ MEMORY MATCH ◂", cx, cy + 80);
        ctx.restore();

        // Flash cards preview shapes floating (two rows)
        ctx.save();
        const t = Date.now() / 1000;
        const previewShapes = [
            { shape: "Circle",    color: C.crimson, ox: -210, oy: 120 },
            { shape: "Square",    color: C.orange,  ox: -147, oy: 128 },
            { shape: "Triangle",  color: C.gold,    ox: -85,  oy: 118 },
            { shape: "Star",      color: C.lime,    ox: -22,  oy: 126 },
            { shape: "Heart",     color: C.sky,     ox: 40,   oy: 116 },
            { shape: "Diamond",   color: C.pink,    ox: 103,  oy: 124 },
            { shape: "Pentagon",  color: C.bronze,  ox: 165,  oy: 114 },
            { shape: "Hexagon",   color: C.forest,  ox: 228,  oy: 122 },
        ];
        previewShapes.forEach((s, i) => {
            const fy = s.oy + Math.sin(t * 1.5 + i * 0.9) * 8;
            ctx.globalAlpha = 0.4 + Math.sin(t + i * 0.8) * 0.2;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = s.color;
            drawCardShape(cx + s.ox, cy + fy, 30, s.shape, s.color);
        });
        ctx.restore();

        // Tap to start
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 20px monospace";
        ctx.shadowColor = C.ice;
        ctx.shadowBlur = 5 + glowIntensity * 10;
        ctx.fillStyle = C.white;
        ctx.globalAlpha = 0.4 + glowIntensity * 0.6;
        ctx.fillText("[ TAP OR PRESS ANY KEY ]", cx, cy + 200);
        ctx.restore();
    }

    // ─── Game Board ──────────────────────────────────────────────
    function drawGameBoard(dt) {
        const layout = getCardLayout();

        drawBackground();
        drawHUD(layout);

        // Update and draw flip animations
        updateFlipAnimations(dt);

        // Draw cards
        cards.forEach((card, i) => {
            const pos = getCardPos(i % COLS, Math.floor(i / COLS), layout);
            const cx = pos.x;
            const cy = pos.y;
            const w = layout.cardW;
            const h = layout.cardH;
            const r = layout.radius;

            // Check if this card is being animated
            const anim = flipAnimations.find(a => a.cardIndex === i && !a.done);
            if (anim) {
                // Draw partial flip
                ctx.save();
                const progress = easeInOut(anim.progress);
                const scaleX = anim.direction === "flipIn"
                    ? lerp(0, 1, progress)
                    : lerp(1, 0, progress);

                if (anim.direction === "flipIn") {
                    // Flip face up: start with back, transition to front
                    ctx.globalAlpha = 1;
                    ctx.scale(scaleX >= 0 ? 1 : 1, 1);
                    if (progress < 0.5) {
                        // Show back shrinking
                        const bs = lerp(1, 0, progress * 2);
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.scale(bs, 1);
                        ctx.translate(-cx, -cy);
                        drawCardBack(cx, cy, w, h, r);
                        ctx.restore();
                    } else {
                        // Show front growing
                        const fs = lerp(0, 1, (progress - 0.5) * 2);
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.scale(fs, 1);
                        ctx.translate(-cx, -cy);
                        if (card.matched) {
                            drawMatchedCard(cx, cy, w, h, r, card.shape, card.color);
                        } else {
                            drawCardFront(cx, cy, w, h, r, card.shape, card.color);
                        }
                        ctx.restore();
                    }
                    ctx.restore();
                } else {
                    // Flip face down: start with front, transition to back
                    ctx.save();
                    if (progress < 0.5) {
                        // Show front shrinking
                        const fs = lerp(1, 0, progress * 2);
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.scale(fs, 1);
                        ctx.translate(-cx, -cy);
                        drawCardFront(cx, cy, w, h, r, card.shape, card.color);
                        ctx.restore();
                    } else {
                        // Show back growing
                        const bs = lerp(0, 1, (progress - 0.5) * 2);
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.scale(bs, 1);
                        ctx.translate(-cx, -cy);
                        drawCardBack(cx, cy, w, h, r);
                        ctx.restore();
                    }
                    ctx.restore();
                }
            } else {
                // Draw card normally
                if (card.faceUp || card.matched || gameState === STATE.PREVIEW) {
                    if (card.matched) {
                        drawMatchedCard(cx, cy, w, h, r, card.shape, card.color);
                    } else {
                        drawCardFront(cx, cy, w, h, r, card.shape, card.color);
                    }
                } else {
                    drawCardBack(cx, cy, w, h, r);
                }
            }
        });

        // Match flash effect
        if (matchFlashTimer > 0) {
            ctx.save();
            ctx.globalAlpha = matchFlashTimer * 0.3;
            ctx.fillStyle = C.white;
            ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
            ctx.restore();
        }

        // Draw selector (only in playing state and not during animations)
        if (gameState === STATE.PLAYING && canInteract) {
            drawSelector(layout);
        }

        drawScanlines();
        drawParticles();
    }

    function updateFlipAnimations(dt) {
        flipAnimations.forEach(anim => {
            if (!anim.done) {
                anim.progress += dt / (anim.duration || FLIP_DURATION);
                if (anim.progress >= 1) {
                    anim.progress = 1;
                    anim.done = true;
                    if (anim.callback) anim.callback();
                }
            }
        });
        // Clean up done animations
        flipAnimations = flipAnimations.filter(a => !a.done);
    }

    // ─── Win / Lose Screens ──────────────────────────────────────
    function drawEndScreen(isWin, dt) {
        const layout = getCardLayout();

        drawBackground();

        if (isWin) {
            winGlow += dt * 2;
        } else {
            loseGlow += dt * 2;
        }

        const cx = INTERNAL_W / 2;
        const cy = INTERNAL_H / 2;

        // Draw cards still visible
        cards.forEach((card, i) => {
            const pos = getCardPos(i % COLS, Math.floor(i / COLS), layout);
            const pcx = pos.x;
            const pcy = pos.y;
            ctx.save();
            ctx.globalAlpha = isWin ? 0.3 : 0.15;
            if (card.faceUp || card.matched) {
                drawCardFront(pcx, pcy, layout.cardW, layout.cardH, layout.radius, card.shape, card.color);
            } else {
                drawCardBack(pcx, pcy, layout.cardW, layout.cardH, layout.radius);
            }
            ctx.restore();
        });

        // Overlay
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = C.black;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
        ctx.restore();

        // Result text
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (isWin) {
            const pulse = Math.sin(winGlow) * 0.3 + 0.7;
            ctx.font = "bold 60px monospace";
            ctx.shadowColor = C.lime;
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.fillStyle = C.lime;
            ctx.fillText("YOU WIN!", cx, cy - 90);

            ctx.font = "22px monospace";
            ctx.shadowColor = C.ice;
            ctx.shadowBlur = 5;
            ctx.fillStyle = C.ice;
            ctx.fillText(`All pairs matched!`, cx, cy - 30);
        } else {
            const pulse = Math.sin(loseGlow) * 0.3 + 0.7;
            ctx.font = "bold 60px monospace";
            ctx.shadowColor = C.crimson;
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.fillStyle = C.crimson;
            ctx.fillText("TIME'S UP!", cx, cy - 90);

            ctx.font = "22px monospace";
            ctx.shadowColor = C.gray;
            ctx.shadowBlur = 5;
            ctx.fillStyle = C.gray;
            ctx.fillText(`Pairs found: ${matchedPairs}/${TOTAL_PAIRS}`, cx, cy - 30);
        }

        // Score display
        if (isWin) {
            const rawScore = Math.max(1, Math.floor(timer) * 5 - misses * 50);
            ctx.font = "bold 48px monospace";
            ctx.shadowColor = C.gold;
            ctx.shadowBlur = 10;
            ctx.fillStyle = C.gold;
            ctx.fillText(`SCORE: ${rawScore}`, cx, cy + 40);

            ctx.font = "18px monospace";
            ctx.fillStyle = C.gray;
            ctx.shadowBlur = 0;
            ctx.fillText(`${Math.floor(timer)}s remaining × 5  -  ${misses} misses × 50`, cx, cy + 85);
        } else {
            ctx.font = "bold 36px monospace";
            ctx.shadowColor = C.crimson;
            ctx.shadowBlur = 8;
            ctx.fillStyle = C.gray;
            ctx.fillText(`SCORE: 0`, cx, cy + 40);
        }

        // Restart prompt
        const blink = Math.sin(Date.now() / 400) * 0.4 + 0.6;
        ctx.font = "bold 18px monospace";
        ctx.shadowColor = C.ice;
        ctx.shadowBlur = 5;
        ctx.fillStyle = C.white;
        ctx.globalAlpha = blink;
        ctx.fillText("[ TAP OR PRESS ANY KEY TO RESTART ]", cx, cy + 140);

        ctx.restore();

        drawScanlines();
        drawParticles();
    }

    // ─── Game Logic ──────────────────────────────────────────────
    function startGame() {
        createCards();
        flippedCards = [];
        matchedPairs = 0;
        misses = 0;
        timer = TOTAL_TIME;
        previewTimer = PREVIEW_TIME;
        selectorRow = 0;
        selectorCol = 0;
        particles = [];
        flipAnimations = [];
        canInteract = false;
        shakeTimer = 0;
        matchFlashCards = [];
        matchFlashTimer = 0;

        gameState = STATE.PREVIEW;

        // Flip all cards face up for preview
        cards.forEach((card, i) => {
            card.faceUp = true;
            card.matched = false;
        });
    }

    function flipCardBack(index) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipOut",
            duration: FLIP_DURATION,
            callback: () => {
                cards[index].faceUp = false;
            }
        });
    }

    function flipCardFront(index) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipIn",
            duration: FLIP_DURATION,
            callback: () => {
                cards[index].faceUp = true;
                checkMatch();
            }
        });
    }

    function checkMatch() {
        if (flippedCards.length < 2) return;

        const [a, b] = flippedCards;
        const cardA = cards[a];
        const cardB = cards[b];

        if (cardA.shape === cardB.shape && cardA.color === cardB.color) {
            // Match!
            cardA.matched = true;
            cardB.matched = true;
            matchedPairs++;

            // Effects
            const layout = getCardLayout();
            const posA = getCardPos(a % COLS, Math.floor(a / COLS), layout);
            const posB = getCardPos(b % COLS, Math.floor(b / COLS), layout);
            spawnMatchParticles(posA.x, posA.y, cardA.color);
            spawnMatchParticles(posB.x, posB.y, cardB.color);

            // Flash
            matchFlashTimer = 0.3;

            // Check win
            if (matchedPairs === TOTAL_PAIRS) {
                setTimeout(() => {
                    gameState = STATE.WIN;
                    particles = [];
                }, 500);
            }
        } else {
            // No match - shake and flip back
            misses++;
            shakeTimer = 0.4;
            shakeIntensity = 8;

            setTimeout(() => {
                flipCardBack(a);
                flipCardBack(b);
            }, 700);
        }

        flippedCards = [];
        canInteract = true;
    }

    function handleCardSelect(index) {
        if (!canInteract || gameState !== STATE.PLAYING) return;
        const card = cards[index];
        if (card.matched || card.faceUp) return;
        if (flippedCards.includes(index)) return;

        canInteract = false;
        flippedCards.push(index);
        flipCardFront(index);
    }

    function handleInput() {
        if (gameState === STATE.TITLE || gameState === STATE.WIN || gameState === STATE.LOSE) {
            startGame();
            return;
        }

        if (gameState === STATE.PLAYING && canInteract) {
            const idx = selectorRow * COLS + selectorCol;
            handleCardSelect(idx);
        }
    }

    // ─── Input Handling ──────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
        // Prevent scrolling with arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
            e.preventDefault();
        }

        if (gameState === STATE.TITLE || gameState === STATE.WIN || gameState === STATE.LOSE) {
            startGame();
            return;
        }

        if (gameState !== STATE.PLAYING) return;

        switch (e.key) {
            case "ArrowUp":
                selectorRow = Math.max(0, selectorRow - 1);
                break;
            case "ArrowDown":
                selectorRow = Math.min(ROWS - 1, selectorRow + 1);
                break;
            case "ArrowLeft":
                selectorCol = Math.max(0, selectorCol - 1);
                break;
            case "ArrowRight":
                selectorCol = Math.min(COLS - 1, selectorCol + 1);
                break;
            case "Enter":
            case " ":
                handleInput();
                break;
        }
    });

    // Mouse/Touch
    canvas.addEventListener("click", handlePointer);
    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        handlePointer(e.touches[0]);
    }, { passive: false });

    function handlePointer(e) {
        if (gameState === STATE.TITLE || gameState === STATE.WIN || gameState === STATE.LOSE) {
            startGame();
            return;
        }

        if (gameState !== STATE.PLAYING || !canInteract) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = INTERNAL_W / rect.width;
        const scaleY = INTERNAL_H / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        const layout = getCardLayout();

        // Find which card was clicked
        for (let i = 0; i < cards.length; i++) {
            const pos = getCardPos(i % COLS, Math.floor(i / COLS), layout);
            const cx = pos.x;
            const cy = pos.y;
            const hw = layout.cardW / 2;
            const hh = layout.cardH / 2;

            if (mx >= cx - hw && mx <= cx + hw && my >= cy - hh && my <= cy + hh) {
                // Update selector position
                selectorCol = i % COLS;
                selectorRow = Math.floor(i / COLS);

                handleCardSelect(i);
                return;
            }
        }
    }

    // ─── Main Game Loop ──────────────────────────────────────────
    function gameLoop(timestamp) {
        const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0;
        lastTime = timestamp;

        // Update shake
        if (shakeTimer > 0) {
            shakeTimer -= dt;
            if (shakeTimer < 0) shakeTimer = 0;
        }

        // Update match flash
        if (matchFlashTimer > 0) {
            matchFlashTimer -= dt;
            if (matchFlashTimer < 0) matchFlashTimer = 0;
        }

        // Update timer (only during playing state)
        if (gameState === STATE.PLAYING) {
            timer -= dt;
            if (timer <= 0) {
                timer = 0;
                gameState = STATE.LOSE;
                canInteract = false;
            }
        }

        // Preview countdown
        if (gameState === STATE.PREVIEW) {
            previewTimer -= dt;
            if (previewTimer <= 0) {
                // Flip all cards back
                cards.forEach((card, i) => {
                    card.faceUp = false;
                    flipCardBack(i);
                });
                setTimeout(() => {
                    gameState = STATE.PLAYING;
                    canInteract = true;
                }, FLIP_DURATION + 100);
            }
        }

        updateParticles();

        // Clear
        ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);

        // Apply shake offset
        ctx.save();
        if (shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * shakeIntensity * (shakeTimer / 0.4);
            const sy = (Math.random() - 0.5) * shakeIntensity * (shakeTimer / 0.4);
            ctx.translate(sx, sy);
        }

        // Draw current state
        switch (gameState) {
            case STATE.TITLE:
                drawTitleScreen(dt);
                break;
            case STATE.PREVIEW:
                drawGameBoard(dt);
                // Draw preview countdown
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = "bold 36px monospace";
                ctx.shadowColor = C.ice;
                ctx.shadowBlur = 10;
                ctx.fillStyle = C.ice;
                ctx.globalAlpha = 0.8;
                ctx.fillText("REMEMBER THESE!", INTERNAL_W / 2, INTERNAL_H / 2 + 50);
                ctx.font = "24px monospace";
                ctx.globalAlpha = 0.6;
                ctx.fillText(`${Math.ceil(previewTimer)}...`, INTERNAL_W / 2, INTERNAL_H / 2 + 90);
                ctx.restore();
                break;
            case STATE.PLAYING:
                drawGameBoard(dt);
                break;
            case STATE.WIN:
                drawEndScreen(true, dt);
                break;
            case STATE.LOSE:
                drawEndScreen(false, dt);
                break;
        }

        ctx.restore(); // shake restore

        requestAnimationFrame(gameLoop);
    }

    // ─── Start ───────────────────────────────────────────────────
    requestAnimationFrame(gameLoop);

})();
