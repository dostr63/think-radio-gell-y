// ============================================================
//  DMX p5 Console  —  sketch.js
//
//  This file is the heart of the application.
//  Everything visual is drawn here by p5.js, frame by frame.
//
//  p5.js works by asking you to define two functions:
//    setup()  — runs once when the page loads
//    draw()   — runs continuously (default ~60 times per second)
//
//  Inside those functions, p5 gives you a vocabulary of drawing
//  commands: rect(), ellipse(), text(), line(), fill(), etc.
//  Each call to draw() repaints the whole canvas from scratch.
//  That's the key idea: animation and interactivity come from
//  changing what you draw on each frame.
// ============================================================


// ── Palette ─────────────────────────────────────────────────
// Defining colours as constants at the top makes them easy to
// change later. p5's color() function accepts hex strings.
const C = {
  bg:         '#0a0a0d',   // void black — the canvas background
  surface:    '#141418',   // slightly lighter — panel backgrounds
  border:     '#2a2a34',   // subtle dividers
  amber:      '#f0a000',   // the primary accent: readouts, labels
  amberDim:   '#7a5008',   // dark amber for unlit elements
  amberGlow:  [240,160,0], // same amber as RGB array (for alpha blending)
  green:      '#00e87a',   // connected / live
  red:        '#e83030',   // error / blackout
  muted:      '#5a5a68',   // secondary text
  text:       '#e8e4dc',   // primary text
};
` `
// ── Gel colours ─────────────────────────────────────────────
// Each DMX channel gets a "gel" — the coloured filter a stage
// light uses. These are drawn as glowing circles. Change these
// to whatever colours you like — this is the fun part!
const GEL_COLOURS = [
  [220,  40,  40],   // Ch 1 — Red
  [  0, 160, 255],   // Ch 2 — Green (DMX RGBW order)
  [ 40, 200,  60],   // Ch 3 — Blue
  [255, 255, 220],   // Ch 4 — White
];
// ── DMX state ────────────────────────────────────────────────
// The DMX universe: 513 bytes. Index 0 unused, indices 1–512
// are the 512 DMX channels. We only use channels 1–4 here,
// but the array holds the full universe so you can expand later.
const universe = new Uint8Array(513);

// ── Channel objects ──────────────────────────────────────────
// Each channel tracks its current value and the fader's drag state.
const CHANNEL_COUNT = 4;
const channels = Array.from({ length: CHANNEL_COUNT }, (_, i) => ({
  id:        i + 1,          // DMX channel number (1-based)
  value:     0,              // current level 0–255
  dragging:  false,          // is the user currently dragging this fader?
  dragOffsetY: 0,            // where on the thumb did they click?
}));

// ── Serial / DMX engine ──────────────────────────────────────
// This section is identical to the HTML version — p5.js doesn't
// change how we talk to the hardware at all.
let port       = null;
let loopActive = false;
let sending    = false;

const BAUD_DMX   = 250000;
const BAUD_BREAK = 9600;
const BREAK_FRAME = new Uint8Array([0x00]);
const DMX_FPS    = 30;

function buildFrame() {
  const frame = new Uint8Array(513);
  frame[0] = 0x00;
  frame.set(universe.subarray(1), 1);
  return frame;
}

async function dmxLoop() {
  while (loopActive && port) {
    const frameStart = performance.now();
    if (!sending) {
      sending = true;
      try {
        // Step 1: generate the DMX break by transmitting at 9600 baud.
        // At this speed, one 0x00 byte holds the line low for ~1 ms,
        // which satisfies the ≥88 µs break requirement.
        await port.open({ baudRate: BAUD_BREAK, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
        const brkWriter = port.writable.getWriter();
        await brkWriter.write(BREAK_FRAME);
        await brkWriter.close();
        await port.close();

        // Step 2: send the actual DMX data at 250 kbaud, 2 stop bits.
        await port.open({ baudRate: BAUD_DMX, dataBits: 8, stopBits: 2, parity: 'none', flowControl: 'none' });
        const dmxWriter = port.writable.getWriter();
        await dmxWriter.write(buildFrame());
        await dmxWriter.close();
        await port.close();
      } catch (e) {
        try { await port.close(); } catch (_) {}
        if (loopActive) {
          console.warn('DMX frame error:', e);
          loopActive = false;
          port = null;
          connectionStatus = 'error';
          document.getElementById('btnDisconnect').style.display = 'none';
        }
      } finally {
        sending = false;
      }
    }

    const elapsed = performance.now() - frameStart;
    await new Promise(r => setTimeout(r, Math.max(5, 1000 / DMX_FPS - elapsed)));
  }
}

async function connectPort(p) {
  if (port) await disconnectPort();
  try {
    connectionStatus = 'connecting';
    await p.open({ baudRate: BAUD_DMX, dataBits: 8, stopBits: 2, parity: 'none', flowControl: 'none' });
    await p.close();
    port = p;
    connectionStatus = 'connected';
    document.getElementById('btnDisconnect').style.display = '';
    loopActive = true;
    dmxLoop();
  } catch (e) {
    connectionStatus = 'error';
    console.error(e);
  }
}

async function disconnectPort() {
  loopActive = false;
  await new Promise(r => setTimeout(r, 80));
  port = null;
  connectionStatus = 'offline';
  document.getElementById('btnDisconnect').style.display = 'none';
}

// ── Connection status (read by the draw loop for the status dot) ──
// Possible values: 'offline' | 'connecting' | 'connected' | 'error'
let connectionStatus = navigator.serial ? 'offline' : 'unsupported';

// ── Layout helpers ────────────────────────────────────────────
// These are recalculated in draw() so the layout responds to
// window resizes automatically — another p5.js strength.

const HEADER_H  = 58;   // height of the top header bar
const FOOTER_H  = 32;   // height of the bottom status bar
const STRIP_PAD = 32;   // horizontal padding around the strip group
const GEL_R     = 36;   // radius of each gel circle

// Returns the bounding box for a channel strip by index (0-based).
// Everything is derived from the canvas size so it scales with the window.
function stripLayout(i) {
  const availW    = width - STRIP_PAD * 2;
  const stripW    = availW / CHANNEL_COUNT;
  const x         = STRIP_PAD + stripW * i;
  const bodyTop   = HEADER_H + 20;
  const bodyH     = height - HEADER_H - FOOTER_H - 40;

  // Sub-regions within each strip
  const gelY      = bodyTop + GEL_R + 10;
  const labelY    = gelY + GEL_R + 22;
  const valueY    = labelY + 24;
  const faderTop  = valueY + 20;
  const faderBot  = bodyTop + bodyH - 50;
  const faderH    = faderBot - faderTop;
  const faderX    = x + stripW / 2;
  const faderW    = 18;   // width of the fader track
  const thumbH    = 34;   // height of the draggable thumb

  // Thumb Y position: maps channel value (0–255) to fader range.
  // Value 0 → thumb at faderBot (bottom), 255 → thumb at faderTop (top).
  const thumbY    = map(channels[i].value, 0, 255, faderBot - thumbH / 2, faderTop + thumbH / 2);

  return { x, stripW, gelY, labelY, valueY, faderTop, faderBot, faderH, faderX, faderW, thumbH, thumbY };
}

// ── p5.js: setup() ───────────────────────────────────────────
// Called once. We create a full-window canvas and wire up the
// HTML port controls that sit on top of the canvas.
function setup() {
  // createCanvas() makes the <canvas> element and returns it.
  // windowWidth / windowHeight are p5 globals.
  createCanvas(windowWidth, windowHeight);

  // Smooth text rendering
  textFont('Courier New');

  // Wire up the HTML port controls (they sit in a <div> over the canvas)
  setupPortControls();
}

// ── p5.js: draw() ────────────────────────────────────────────
// Called ~60 times per second. Everything you see is redrawn here.
function draw() {
  // Clear the canvas each frame
  background(C.bg);

  drawHeader();
  drawStrips();
  drawFooter();
  drawGlobalControls();
}

// ── p5.js: windowResized() ───────────────────────────────────
// p5 calls this automatically when the browser window changes size.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ── Drawing: header bar ──────────────────────────────────────
function drawHeader() {
  // Draw the header background
  noStroke();
  fill(C.surface);
  rect(0, 0, width, HEADER_H);

  // Bottom border line
  stroke(C.border);
  strokeWeight(1);
  line(0, HEADER_H, width, HEADER_H);

  // Logo / title — drawn with p5's text() function
  noStroke();
  fill(C.amber);
  textSize(15);
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  text('DMX  CONSOLE', 24, HEADER_H / 2 - 6);

  fill(C.muted);
  textSize(10);
  textStyle(NORMAL);
  text('ENTTEC OPEN DMX  ·  p5.js', 24, HEADER_H / 2 + 10);

  // The port selector HTML lives in the centre — p5 draws labels around it
  // (the select element itself is positioned by CSS)

  // Status dot (right side of header)
  drawStatusDot(width - 120, HEADER_H / 2);
}

// ── Drawing: status dot ──────────────────────────────────────
function drawStatusDot(x, y) {
  // Choose colour and label based on connectionStatus
  let dotCol, label;
  if (connectionStatus === 'connected') {
    dotCol = color(C.green);
    label  = 'CONNECTED';
  } else if (connectionStatus === 'connecting') {
    dotCol = color(C.amber);
    label  = 'CONNECTING';
  } else if (connectionStatus === 'error') {
    dotCol = color(C.red);
    label  = 'ERROR';
  } else if (connectionStatus === 'unsupported') {
    dotCol = color(C.red);
    label  = 'NO WEB SERIAL';
  } else {
    dotCol = color(C.muted);
    label  = 'OFFLINE';
  }

  // Outer glow (only when connected) — drawn as a larger, transparent circle
  if (connectionStatus === 'connected') {
    // sin(frameCount * 0.05) produces a value that oscillates between -1 and 1.
    // frameCount is a p5 global that increments every draw() call.
    // This creates a gentle pulsing glow — your first p5 animation!
    const pulse = sin(frameCount * 0.05) * 0.3 + 0.7;
    noStroke();
    fill(red(dotCol), green(dotCol), blue(dotCol), 60 * pulse);
    circle(x, y, 20);
  }

  // The dot itself
  noStroke();
  fill(dotCol);
  circle(x, y, 9);

  // Label
  fill(connectionStatus === 'connected' ? C.green : C.muted);
  textSize(9);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  text(label, x + 10, y);
}

// ── Drawing: all four channel strips ────────────────────────
function drawStrips() {
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    drawStrip(i);
  }
}

// ── Drawing: a single channel strip ─────────────────────────
function drawStrip(i) {
  const ch  = channels[i];
  const gel = GEL_COLOURS[i];
  const L   = stripLayout(i);

  // ── 1. Gel (the coloured stage-light simulation) ──────────
  // The gel brightness scales with the channel value.
  // map(value, fromLow, fromHigh, toLow, toHigh) is a very
  // useful p5 function — it rescales a number between ranges.
  const brightness = map(ch.value, 0, 255, 0, 1);

  if (ch.value > 0) {
    // Outer atmospheric halo — multiple concentric transparent circles
    // create a soft light spill effect.
    for (let r = GEL_R * 4; r > GEL_R; r -= 8) {
      const alpha = map(r, GEL_R, GEL_R * 4, 40, 0) * brightness;
      noStroke();
      fill(gel[0], gel[1], gel[2], alpha);
      circle(L.faderX, L.gelY, r * 2);
    }
  }

  // Gel circle itself: dark when off, full colour when at 255
  const gelR = lerp(20, GEL_R, brightness);  // lerp() blends between two values
  const gelAlpha = lerp(40, 255, brightness);
  noStroke();
  fill(gel[0], gel[1], gel[2], gelAlpha);
  circle(L.faderX, L.gelY, gelR * 2);

  // Bright highlight spot in the centre of the gel (specular)
  if (ch.value > 0) {
    fill(255, 255, 255, 120 * brightness);
    circle(L.faderX - gelR * 0.25, L.gelY - gelR * 0.25, gelR * 0.4);
  }

  // ── 2. Channel label & value ──────────────────────────────
  textAlign(CENTER, TOP);

  const RGBW_LABELS = ['R', 'G', 'B', 'W'];
  fill(C.amber);
  textSize(11);
  textStyle(BOLD);
  text(RGBW_LABELS[i] + '  ·  CH ' + ch.id, L.faderX, L.labelY);
  // Value readout — glows amber when live, muted when zero
  const valBrightness = map(ch.value, 0, 255, 80, 255);
  fill(240, 160, 0, valBrightness);
  textSize(28);
  textStyle(BOLD);
  text(ch.value, L.faderX, L.valueY);

  fill(C.muted);
  textSize(9);
  textStyle(NORMAL);
  text('/ 255', L.faderX, L.valueY + 32);

  // ── 3. Fader track ────────────────────────────────────────
  const trackX = L.faderX - L.faderW / 2;

  // Track background
  noStroke();
  fill(C.surface);
  rect(trackX, L.faderTop, L.faderW, L.faderH, 7);

  // Fill bar: the coloured portion below the thumb.
  // Its height maps the channel value to the fader range.
  const fillH = map(ch.value, 0, 255, 0, L.faderH);
  if (fillH > 0) {
    // Draw from the bottom of the track upward
    fill(gel[0], gel[1], gel[2], 180);
    rect(trackX, L.faderBot - fillH, L.faderW, fillH,
      0, 0, 7, 7  // rounded bottom corners only
    );
  }

  // Track border
  stroke(C.border);
  strokeWeight(1);
  noFill();
  rect(trackX, L.faderTop, L.faderW, L.faderH, 7);

  // ── 4. LED tick marks alongside the track ────────────────
  // These are small rectangles that light up as the value increases,
  // like the meter on a mixing desk.
  const tickCount = 20;
  const tickW     = 8;
  const tickH     = 3;
  const tickGap   = L.faderH / tickCount;
  const tickX     = trackX - tickW - 4;

  for (let t = 0; t < tickCount; t++) {
    // t=0 is at the bottom, t=19 at the top
    const tickY      = L.faderBot - (t + 1) * tickGap + tickGap / 2;
    const threshold  = (t / tickCount) * 255;  // value needed to light this tick
    const lit        = ch.value > threshold;

    noStroke();
    if (lit) {
      // Colour shifts from green (low) through amber (mid) to red (high)
      if (t < 14)      fill(0, 232, 122, 200);   // green
      else if (t < 18) fill(240, 160, 0, 200);   // amber
      else             fill(232, 48, 48, 200);   // red
    } else {
      fill(C.border);
    }
    rect(tickX, tickY - tickH / 2, tickW, tickH, 1);
  }

  // ── 5. Fader thumb ────────────────────────────────────────
  // The draggable handle. We draw it wider than the track so it's
  // easy to grab.
  const thumbW = L.faderW + 20;
  const thumbX = L.faderX - thumbW / 2;
  const thumbTop = L.thumbY - L.thumbH / 2;

  // Thumb shadow
  noStroke();
  fill(0, 0, 0, 80);
  rect(thumbX + 2, thumbTop + 3, thumbW, L.thumbH, 5);

  // Thumb body
  fill(ch.dragging ? '#505060' : '#38383e');
  stroke(ch.dragging ? C.amber : '#58586a');
  strokeWeight(ch.dragging ? 1.5 : 1);
  rect(thumbX, thumbTop, thumbW, L.thumbH, 5);

  // Thumb grip lines (the three horizontal ridges on a real fader)
  stroke(ch.dragging ? C.amber : C.muted);
  strokeWeight(1);
  const gripSpacing = 5;
  for (let g = -1; g <= 1; g++) {
    const gripY = L.thumbY + g * gripSpacing;
    line(thumbX + 6, gripY, thumbX + thumbW - 6, gripY);
  }

  // ── 6. Strip divider ─────────────────────────────────────
  if (i < CHANNEL_COUNT - 1) {
    stroke(C.border);
    strokeWeight(1);
    line(L.x + L.stripW, HEADER_H + 10, L.x + L.stripW, height - FOOTER_H - 10);
  }
}

// ── Drawing: global controls (Blackout / Full On) ───────────
// These are drawn by p5 as rounded rectangles with text.
// We track hover state manually using mouseX / mouseY.
function drawGlobalControls() {
  const btnW  = 130;
  const btnH  = 34;
  const btnY  = height - FOOTER_H - btnH - 10;
  const totalW = btnW * 2 + 16;
  const startX = (width - totalW) / 2;

  drawButton('BLACKOUT', startX,          btnY, btnW, btnH, C.red,   '#e8303033');
  drawButton('FULL  ON', startX + btnW + 16, btnY, btnW, btnH, C.amber, '#f0a00033');
}

function drawButton(label, x, y, w, h, col, hoverFill) {
  const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;

  noStroke();
  fill(hovered ? hoverFill : 0);
  stroke(col);
  strokeWeight(1);
  rect(x, y, w, h, 4);

  noStroke();
  fill(col);
  textSize(11);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text(label, x + w / 2, y + h / 2);
}

// ── Drawing: footer ──────────────────────────────────────────
function drawFooter() {
  noStroke();
  fill(C.surface);
  rect(0, height - FOOTER_H, width, FOOTER_H);

  stroke(C.border);
  strokeWeight(1);
  line(0, height - FOOTER_H, width, height - FOOTER_H);

  fill(C.muted);
  textSize(9);
  textStyle(NORMAL);
  textAlign(LEFT, CENTER);
  text('DMX 512  ·  Web Serial API  ·  p5.js 1.9.4', 16, height - FOOTER_H / 2);

  // Frame rate display — useful when learning / optimising p5 sketches
  textAlign(RIGHT, CENTER);
  text('FPS  ' + nf(frameRate(), 1, 0), width - 16, height - FOOTER_H / 2);
}

// ── p5.js: mousePressed() ────────────────────────────────────
// p5 calls this when the mouse button goes down.
// We check whether the click landed on a fader thumb or a button.
function mousePressed() {
  // Check global buttons first
  const btnW  = 130;
  const btnH  = 34;
  const btnY  = height - FOOTER_H - btnH - 10;
  const totalW = btnW * 2 + 16;
  const startX = (width - totalW) / 2;

  if (mouseX >= startX && mouseX <= startX + btnW && mouseY >= btnY && mouseY <= btnY + btnH) {
    // Blackout: set all channels to 0
    setAllChannels(0);
    return;
  }
  if (mouseX >= startX + btnW + 16 && mouseX <= startX + btnW * 2 + 16 && mouseY >= btnY && mouseY <= btnY + btnH) {
    // Full on: set all channels to 255
    setAllChannels(255);
    return;
  }

  // Check fader thumbs
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    const L = stripLayout(i);
    const thumbW  = L.faderW + 20;
    const thumbX  = L.faderX - thumbW / 2;
    const thumbTop = L.thumbY - L.thumbH / 2;

    if (mouseX >= thumbX && mouseX <= thumbX + thumbW &&
        mouseY >= thumbTop && mouseY <= thumbTop + L.thumbH) {
      channels[i].dragging    = true;
      channels[i].dragOffsetY = mouseY - L.thumbY;
      return;
    }

    // Also allow clicking anywhere on the track to jump the fader
    const trackX = L.faderX - L.faderW / 2;
    if (mouseX >= trackX - 10 && mouseX <= trackX + L.faderW + 10 &&
        mouseY >= L.faderTop && mouseY <= L.faderBot) {
      const v = floor(map(mouseY, L.faderBot, L.faderTop, 0, 255, true));
      setChannel(i, v);
      channels[i].dragging    = true;
      channels[i].dragOffsetY = 0;
    }
  }
}

// ── p5.js: mouseDragged() ────────────────────────────────────
// Called every frame the mouse moves while a button is held.
function mouseDragged() {
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    if (!channels[i].dragging) continue;
    const L = stripLayout(i);

    // Convert the current mouse Y position to a 0–255 value.
    // constrain() clamps the result so it never goes out of range.
    const targetY = mouseY - channels[i].dragOffsetY;
    const v = floor(map(targetY, L.faderBot, L.faderTop, 0, 255));
    setChannel(i, constrain(v, 0, 255));
  }
}

// ── p5.js: mouseReleased() ───────────────────────────────────
// Called when the mouse button is released.
function mouseReleased() {
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    channels[i].dragging = false;
  }
}

// ── p5.js: mouseWheel() ──────────────────────────────────────
// Called when the scroll wheel moves over the canvas.
// This lets you fine-tune a channel value without dragging.
function mouseWheel(event) {
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    const L = stripLayout(i);
    if (mouseX >= L.x && mouseX <= L.x + L.stripW) {
      // event.delta is positive when scrolling down, negative when up
      const v = constrain(channels[i].value - floor(event.delta / 3), 0, 255);
      setChannel(i, v);
      return false; // prevent the page from scrolling
    }
  }
}

// ── Channel value helper ─────────────────────────────────────
function setChannel(index, value) {
  channels[index].value    = value;
  universe[channels[index].id] = value;
}

function setAllChannels(value) {
  for (let i = 0; i < CHANNEL_COUNT; i++) {
    setChannel(i, value);
  }
}

// ── Port controls (HTML elements overlaid on the canvas) ─────
function setupPortControls() {
  const portSelect    = document.getElementById('portSelect');
  const btnScan       = document.getElementById('btnScan');
  const btnDisconnect = document.getElementById('btnDisconnect');

  if (!navigator.serial) {
    connectionStatus = 'unsupported';
    btnScan.disabled = true;
    return;
  }

  // Populate already-granted ports on load
  populatePorts();

  btnScan.addEventListener('click', async () => {
    try {
      const filters = [
        { usbVendorId: 0x0403, usbProductId: 0x6001 },
        { usbVendorId: 0x0403, usbProductId: 0x6015 },
      ];
      const newPort = await navigator.serial.requestPort({ filters });
      await populatePorts();
      for (let i = 1; i < portSelect.options.length; i++) {
        if (portSelect.options[i]._port === newPort) {
          portSelect.selectedIndex = i;
          break;
        }
      }
      await connectPort(newPort);
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        connectionStatus = 'error';
        console.error(e);
      }
    }
  });

  portSelect.addEventListener('change', async () => {
    const opt = portSelect.options[portSelect.selectedIndex];
    if (opt && opt._port) await connectPort(opt._port);
  });

  btnDisconnect.addEventListener('click', disconnectPort);

  navigator.serial.addEventListener('disconnect', e => {
    if (port === e.target) {
      disconnectPort();
      connectionStatus = 'error';
    }
  });
}

async function populatePorts() {
  const portSelect = document.getElementById('portSelect');
  if (!navigator.serial) return;
  const ports = await navigator.serial.getPorts();
  portSelect.innerHTML = '<option value="">— select port —</option>';
  ports.forEach((p, i) => {
    const info  = p.getInfo();
    const label = info.usbVendorId
      ? `Port ${i + 1}  [VID:${info.usbVendorId.toString(16).toUpperCase()}]`
      : `Port ${i + 1}`;
    const opt   = document.createElement('option');
    opt.value   = i;
    opt.textContent = label;
    opt._port   = p;
    portSelect.appendChild(opt);
  });
  if (portSelect.options.length === 2) portSelect.selectedIndex = 1;
}
