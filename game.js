// Prism Panic - Cyberpunk Memory Match Game (Refactored)
// Fixed Alignment, Layout Logic, and Title Screen separation

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

    const CARD_COLORS = [C.crimson, C.orange, C.gold, C.lime, C.sky, C.pink, C.bronze, C.forest];
    const SHAPES = ["Circle", "Square", "Triangle", "Star", "Heart", "Diamond", "Pentagon", "Hexagon"];
    const TOTAL_PAIRS = SHAPES.length; // 8
    const COLS = 4;
    const ROWS = 4;

    // ─── Game Constants ──────────────────────────────────────────
    // Increased width slightly (800x640) to accommodate 4x4 grid better without crowding
    const INTERNAL_W = 800;
    const INTERNAL_H = 640; 
    
    const TOTAL_TIME = 300; // 5 minutes
    const PREVIEW_TIME = 3; // 3 seconds
    const FLIP_DURATION = 300; // ms for flip animation

    // Layout Boundaries for Title Screen
    const TITLE_TOP = 100;
    const TITLE_BOTTOM = 540;

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

    // ─── Game State Variables ────────────────────────────────────
    let gameState = STATE.TITLE;
    let cards = [];
    let flippedCards = [];
    let matchedPairs = 0;
    let misses = 0;
    let timer = TOTAL_TIME;
    let lastTime = 0;
    let previewTimer = PREVIEW_TIME;
    
    // Input selection state
    let selectorRow = 0;
    let selectorCol = 0;
    
    // Animation/Visual vars
    let titlePulse = 0;
    let scanlineOffset = 0;
    let particles = [];
    let flipAnimations = [];
    let canInteract = true;
    let shakeTimer = 0;
    let shakeIntensity = 0;
    let winGlow = 0;
    let loseGlow = 0;
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
    function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ─── Card Geometry & Layout (FIXED) ──────────────────────────
    function getCardLayout() {
        // Define safe zones to prevent overlap
        const topMargin = 60; // Space for HUD
        const bottomMargin = 30;
        const sideMargin = 40; // Left/Right padding
        
        const availW = INTERNAL_W - (sideMargin * 2);
        const availH = INTERNAL_H - topMargin - bottomMargin;
        
        const cardGap = 15; // Increased gap slightly for breathing room
        
        // Calculate max possible card size based on Height
        const sizeByH = Math.floor((availH - (cardGap * (ROWS - 1))) / ROWS);
        // Calculate max possible card size based on Width
        const sizeByW = Math.floor((availW - (cardGap * (COLS - 1))) / COLS);
        
        // Take the smaller of the two to ensure it fits both dimensions
        const cardSize = Math.min(sizeByH, sizeByW);

        // Center the grid in the available space
        const gridW = (cardSize * COLS) + (cardGap * (COLS - 1));
        const gridH = (cardSize * ROWS) + (cardGap * (ROWS - 1));
        
        const startX = sideMargin + (availW - gridW) / 2;
        const startY = topMargin + (availH - gridH) / 2;
        
        // Corner radius based on card size
        const radius = Math.max(8, cardSize * 0.1);

        return { cardW: cardSize, cardH: cardSize, startX, startY, cardGap, topMargin, radius };
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
        // Create pairs
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
            INTERNAL_W / 2, INTERNAL_H / 2, INTERNAL_W * 0.8
        );
        grad.addColorStop(0, C.navy);
        grad.addColorStop(1, C.black);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

        // Cyberpunk Grid
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
        ctx.globalAlpha = 0.1;
        for (let y = scanlineOffset; y < INTERNAL_H; y += 4) {
            ctx.fillRect(0, y, INTERNAL_W, 1);
        }
        ctx.globalAlpha = 1;
    }

    // ─── Shape Drawing Helpers ──────────────────────────────────
    function drawCardShape(cx, cy, size, shape, color) {
        const s = size * 0.5;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";

        switch (shape) {
            case "Circle":
                ctx.beginPath(); ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2); ctx.fill(); break;
            case "Square":
                ctx.beginPath(); ctx.rect(cx - s*0.4, cy - s*0.4, s*0.8, s*0.8); ctx.fill(); break;
            case "Triangle":
                ctx.beginPath();
                ctx.moveTo(cx, cy - s * 0.45);
                ctx.lineTo(cx + s * 0.45, cy + s * 0.35);
                ctx.lineTo(cx - s * 0.45, cy + s * 0.35);
                ctx.closePath(); ctx.fill(); break;
            case "Star":
                // Draw Star
                ctx.beginPath();
                for(let i=0; i<10; i++){
                    const r = (i%2 === 0) ? s*0.48 : s*0.22;
                    const angle = (Math.PI/5)*i - Math.PI/2;
                    const x = cx + Math.cos(angle)*r;
                    const y = cy + Math.sin(angle)*r;
                    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
                }
                ctx.closePath(); ctx.fill(); break;
            case "Heart":
                // Draw Heart
                const hs = s * 0.4;
                ctx.beginPath();
                ctx.moveTo(cx, cy + hs*0.8);
                ctx.bezierCurveTo(cx-hs*1.5, cy-hs, cx-hs*1.5, cy-hs*1.5, cx, cy-hs*0.5);
                ctx.bezierCurveTo(cx+hs*1.5, cy-hs*1.5, cx+hs*1.5, cy-hs, cx, cy+hs*0.8);
                ctx.closePath(); ctx.fill(); break;
            case "Diamond":
                ctx.beginPath();
                ctx.moveTo(cx, cy - s * 0.48);
                ctx.lineTo(cx + s * 0.35, cy);
                ctx.lineTo(cx, cy + s * 0.48);
                ctx.lineTo(cx - s * 0.35, cy);
                ctx.closePath(); ctx.fill(); break;
            case "Pentagon":
            case "Hexagon":
                const sides = shape === "Pentagon" ? 5 : 6;
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
                    ctx.lineTo(cx + Math.cos(angle) * s * 0.45, cy + Math.sin(angle) * s * 0.45);
                }
                ctx.closePath(); ctx.fill(); break;
        }
        ctx.restore();
    }

    function drawCardBack(cx, cy, w, h, radius) {
        ctx.fillStyle = C.slate;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.fill();

        ctx.strokeStyle = C.ocean;
        ctx.lineWidth = 2;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.stroke();

        // Inner design
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = C.sky;
        ctx.font = `bold ${Math.floor(w * 0.15)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PRISM", cx, cy);
        ctx.restore();
    }

    function drawCardFront(cx, cy, w, h, radius, shape, color) {
        const grad = ctx.createLinearGradient(cx - w/2, cy - h/2, cx + w/2, cy + h/2);
        grad.addColorStop(0, C.navy);
        grad.addColorStop(1, "#0D1B2A");
        ctx.fillStyle = grad;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.fill();

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        roundRect(cx - w/2, cy - h/2, w, h, radius);
        ctx.stroke();
        ctx.restore();

        drawCardShape(cx, cy, w, shape, color);
    }

    function drawMatchedCard(cx, cy, w, h, radius, shape, color) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        drawCardFront(cx, cy, w, h, radius, shape, color);
        ctx.restore();

        // Checkmark
        ctx.save();
        ctx.strokeStyle = C.lime;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - w*0.2, cy);
        ctx.lineTo(cx - w*0.05, cy + w*0.15);
        ctx.lineTo(cx + w*0.25, cy - w*0.15);
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

    // ─── HUD Drawing ───────────────────────────────────────────
    function drawHUD(layout) {
        // Timer
        const mins = Math.floor(timer / 60);
        const secs = Math.floor(timer % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

        ctx.save();
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        let color = C.ice;
        if(timer <= 30) color = C.crimson;
        
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillText(`⏱ ${timeStr}`, 20, 15);
        ctx.restore();

        // Pairs
        ctx.save();
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "right";
        ctx.fillStyle = C.lime;
        ctx.shadowColor = C.lime;
        ctx.shadowBlur = 5;
        ctx.fillText(`${matchedPairs}/${TOTAL_PAIRS}`, INTERNAL_W - 20, 20);
        ctx.restore();

        // Misses
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = C.orange;
        ctx.shadowColor = C.orange;
        ctx.fillText(`Misses: ${misses}`, INTERNAL_W / 2, 20);
        ctx.restore();
    }

    // ─── Title Screen (FIXED - Dedicated Area) ─────────────────
    function drawTitleScreen(dt) {
        drawBackground();
        drawScanlines();

        const cx = INTERNAL_W / 2;
        const cy = INTERNAL_H / 2; // Center of the screen

        // Title Glow
        titlePulse += dt * 2;
        const pulse = Math.sin(titlePulse) * 0.3 + 0.7;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // PRISM
        ctx.shadowColor = C.sky;
        ctx.shadowBlur = 20 * pulse;
        ctx.fillStyle = C.ice;
        ctx.font = "bold 80px monospace";
        ctx.fillText("PRISM", cx, cy - 60);

        // PANIC
        ctx.shadowColor = C.crimson;
        ctx.shadowBlur = 20 * pulse;
        ctx.fillStyle = C.crimson;
        ctx.font = "bold 50px monospace";
        ctx.fillText("PANIC", cx, cy + 20);

        // Instructions
        ctx.font = "18px monospace";
        ctx.fillStyle = C.gray;
        ctx.shadowBlur = 0;
        ctx.fillText("MATCH THE CYBER-SHAPES", cx, cy + 80);

        // Start Prompt
        const blink = Math.sin(Date.now() / 300) * 0.4 + 0.6;
        ctx.font = "bold 22px monospace";
        ctx.fillStyle = C.white;
        ctx.globalAlpha = blink;
        ctx.fillText("[ CLICK OR PRESS SPACE TO START ]", cx, cy + 150);

        ctx.restore();
    }

    // ─── Game Board (FIXED - Proper Z-Index & Sizing) ─────────
    function drawGameBoard(dt) {
        const layout = getCardLayout();

        // 1. Draw Background
        drawBackground();

        // 2. Draw HUD (Top Layer)
        drawHUD(layout);

        // 3. Draw Flip Animations & Cards
        updateFlipAnimations(dt);

        cards.forEach((card, i) => {
            const pos = getCardPos(i % COLS, Math.floor(i / COLS), layout);
            const cx = pos.x;
            const cy = pos.y;
            const w = layout.cardW;
            const h = layout.cardH;
            const r = layout.radius;

            const anim = flipAnimations.find(a => a.cardIndex === i && !a.done);

            // If animating
            if (anim) {
                drawAnimatedCard(cx, cy, w, h, r, card, anim);
            } 
            // Normal State
            else {
                if (card.matched) {
                    drawMatchedCard(cx, cy, w, h, r, card.shape, card.color);
                } else if (card.faceUp || gameState === STATE.PREVIEW) {
                    drawCardFront(cx, cy, w, h, r, card.shape, card.color);
                } else {
                    drawCardBack(cx, cy, w, h, r);
                }
            }
        });

        // 4. Match Flash Effect
        if (matchFlashTimer > 0) {
            ctx.save();
            ctx.fillStyle = C.white;
            ctx.globalAlpha = matchFlashTimer * 0.2;
            ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
            ctx.restore();
        }

        // 5. Selection Selector
        if (gameState === STATE.PLAYING && canInteract) {
            drawSelector(layout);
        }

        drawScanlines();
        drawParticles();
    }

    function drawAnimatedCard(cx, cy, w, h, r, card, anim) {
        const progress = easeInOut(anim.progress);
        
        ctx.save();
        // Use scaleX to simulate flip
        const scaleX = anim.direction === "flipIn" ? 1 - (2*progress) : (2*progress) - 1;
        
        if (Math.abs(scaleX) < 0.05) scaleX = 0; // Hide exactly when turning

        ctx.translate(cx, cy);
        ctx.scale(scaleX, 1);
        ctx.translate(-cx, -cy);

        // When facing away (scaleX < 0) show back, else show front
        if (scaleX < 0) {
             // We are essentially looking at the back while flipping
             // But for this simple 2D flip, we just toggle face immediately 
             // or draw the reverse side. 
             // Simplest approach: Draw Front when flipping IN, Back when flipping OUT
             if(anim.direction === "flipIn") {
                 // Currently facing away from user (simulated)
                 drawCardBack(cx, cy, w, h, r); 
             } else {
                 drawCardFront(cx, cy, w, h, r, card.shape, card.color);
             }
        } else {
            // Facing user
            if(anim.direction === "flipIn") {
                drawCardFront(cx, cy, w, h, r, card.shape, card.color);
            } else {
                drawCardBack(cx, cy, w, h, r);
            }
        }
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
        roundRect(cx - w/2 - 4, cy - h/2 - 4, w + 8, h + 8, r);
        ctx.stroke();
        ctx.restore();
    }

    // ─── Particles ───────────────────────────────────────────────
    function spawnMatchParticles(cx, cy, color) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.03,
                color: color,
                size: 2 + Math.random() * 4
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
        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
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
        matchFlashTimer = 0;
        
        gameState = STATE.PREVIEW;

        // Flip all cards face up for preview
        cards.forEach((card, i) => {
            card.faceUp = true;
            card.matched = false;
            flipAnimations.push({
                cardIndex: i,
                progress: 0,
                direction: "flipIn",
                done: false,
                duration: 500 // Slower for preview
            });
        });
    }

    function flipCard(index, callback) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipIn", // Face up
            done: false,
            callback: callback,
            duration: FLIP_DURATION
        });
    }

    function flipCardBack(index, callback) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipOut", // Face down
            done: false,
            callback: callback,
            duration: FLIP_DURATION
        });
    }

    function updateFlipAnimations(dt) {
        flipAnimations.forEach(anim => {
            if (!anim.done) {
                anim.progress += dt / (anim.duration * 0.001);
                if (anim.progress >= 1) {
                    anim.progress = 1;
                    anim.done = true;
                    if (anim.callback) anim.callback();
                }
            }
        });
        flipAnimations = flipAnimations.filter(a => !a.done);
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

            const layout = getCardLayout();
            const posA = getCardPos(a % COLS, Math.floor(a / COLS), layout);
            const posB = getCardPos(b % COLS, Math.floor(b / COLS), layout);
            spawnMatchParticles(posA.x, posA.y, cardA.color);
            spawnMatchParticles(posB.x, posB.y, cardB.color);
            matchFlashTimer = 0.3;

            flippedCards = [];
            canInteract = true;

            if (matchedPairs === TOTAL_PAIRS) {
                setTimeout(() => { gameState = STATE.WIN; }, 1000);
            }
        } else {
            // No Match
            misses++;
            shakeTimer = 0.4;
            shakeIntensity = 10;
            
            flippedCards = [];
            
            // Flip back after delay
            setTimeout(() => {
                if(gameState !== STATE.PLAYING) return;
                flipCardBack(a);
                flipCardBack(b);
            }, 800);
        }
    }

    function handleCardSelect(index) {
        if (!canInteract || gameState !== STATE.PLAYING) return;
        const card = cards[index];
        if (card.matched || card.faceUp || flippedCards.includes(index)) return;

        canInteract = false;
        flippedCards.push(index);
        
        // Small delay to ensure visual order
        flipCardFront(index);
        if(flippedCards.length === 2) {
             setTimeout(checkMatch, 350); // Wait for second flip animation
        }
    }

    function flipCardFront(index) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipIn",
            done: false,
            duration: FLIP_DURATION
        });
    }

    function flipCardBack(index) {
        flipAnimations.push({
            cardIndex: index,
            progress: 0,
            direction: "flipOut",
            done: false,
            duration: FLIP_DURATION
        });
        cards[index].faceUp = false;
    }

    // ─── Input Handling ──────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
            e.preventDefault();
        }

        if (gameState === STATE.TITLE || gameState === STATE.WIN || gameState === STATE.LOSE) {
            startGame();
            return;
        }

        if (gameState !== STATE.PLAYING) return;

        switch (e.key) {
            case "ArrowUp":    selectorRow = Math.max(0, selectorRow - 1); break;
            case "ArrowDown":  selectorRow = Math.min(ROWS - 1, selectorRow + 1); break;
            case "ArrowLeft":  selectorCol = Math.max(0, selectorCol - 1); break;
            case "ArrowRight": selectorCol = Math.min(COLS - 1, selectorCol + 1); break;
            case "Enter":
            case " ":          handleCardSelect(selectorRow * COLS + selectorCol); break;
        }
    });

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

        for (let i = 0; i < cards.length; i++) {
            const pos = getCardPos(i % COLS, Math.floor(i / COLS), layout);
            // Simple hit detection
            if (mx >= pos.x - layout.cardW/2 && mx <= pos.x + layout.cardW/2 &&
                my >= pos.y - layout.cardH/2 && my <= pos.y + layout.cardH/2) {
                
                selectorCol = i % COLS;
                selectorRow = Math.floor(i / COLS);
                handleCardSelect(i);
                return;
            }
        }
    }

    // ─── End Screens ─────────────────────────────────────────────
    function drawEndScreen(isWin) {
        drawBackground();
        
        // Dim Overlay
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
        ctx.restore();

        const cx = INTERNAL_W / 2;
        const cy = INTERNAL_H / 2;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (isWin) {
            ctx.font = "bold 60px monospace";
            ctx.fillStyle = C.lime;
            ctx.shadowColor = C.lime;
            ctx.shadowBlur = 20;
            ctx.fillText("SYSTEM SECURE", cx, cy - 40);
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = C.ice;
            ctx.font = "24px monospace";
            ctx.fillText(`Score: ${Math.floor(timer) * 10}`, cx, cy + 30);

        } else {
            ctx.font = "bold 60px monospace";
            ctx.fillStyle = C.crimson;
            ctx.shadowColor = C.crimson;
            ctx.shadowBlur = 20;
            ctx.fillText("CONNECTION LOST", cx, cy - 40);

            ctx.shadowBlur = 0;
            ctx.fillStyle = C.gray;
            ctx.font = "24px monospace";
            ctx.fillText(`Pairs: ${matchedPairs}/${TOTAL_PAIRS}`, cx, cy + 30);
        }

        const blink = Math.sin(Date.now() / 300) * 0.4 + 0.6;
        ctx.font = "20px monospace";
        ctx.fillStyle = C.white;
        ctx.globalAlpha = blink;
        ctx.fillText("[ CLICK TO RESTART ]", cx, cy + 120);
        ctx.restore();
    }

    // ─── Main Loop ──────────────────────────────────────────────
    function gameLoop(timestamp) {
        const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0;
        lastTime = timestamp;

        // Update Timer
        if (gameState === STATE.PLAYING) {
            timer -= dt;
            if (timer <= 0) {
                timer = 0;
                gameState = STATE.LOSE;
            }
        }
        // Preview Timer
        else if (gameState === STATE.PREVIEW) {
            previewTimer -= dt;
            if (previewTimer <= 0) {
                // End preview
                cards.forEach((card, i) => {
                    card.faceUp = false;
                    flipCardBack(i);
                });
                setTimeout(() => {
                    gameState = STATE.PLAYING;
                    canInteract = true;
                }, FLIP_DURATION + 200);
            }
        }

        if (shakeTimer > 0) shakeTimer -= dt;
        if (matchFlashTimer > 0) matchFlashTimer -= dt;

        // Clear Canvas
        ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);

        // Shake Effect
        ctx.save();
        if (shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * 20 * shakeTimer;
            const sy = (Math.random() - 0.5) * 20 * shakeTimer;
            ctx.translate(sx, sy);
        }

        // Draw based on state
        switch (gameState) {
            case STATE.TITLE:
                drawTitleScreen(dt);
                break;
            case STATE.PREVIEW:
                drawGameBoard(dt);
                ctx.save();
                ctx.fillStyle = C.white;
                ctx.font = "bold 30px monospace";
                ctx.shadowColor = C.sky;
                ctx.shadowBlur = 10;
                ctx.fillText("MEMORY MODE", INTERNAL_W/2, INTERNAL_H - 50);
                ctx.restore();
                break;
            case STATE.PLAYING:
                drawGameBoard(dt);
                break;
            case STATE.WIN:
                drawEndScreen(true);
                break;
            case STATE.LOSE:
                drawEndScreen(false);
                break;
        }

        ctx.restore(); // End Shake
        updateParticles();

        requestAnimationFrame(gameLoop);
    }

    // Start
    requestAnimationFrame(gameLoop);

})();

