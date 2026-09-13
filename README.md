# GELL-Y 💡

**The easiest way to control your Z-RAY lights.**

GELL-Y is a lighting controller for [Think Radio's Z-RAY wireless DMX lighting system](https://thinkrad.io). It runs directly in your web browser — nothing to install, nothing to configure, just open it and start controlling your lights.

You don't need to know anything about DMX, lighting protocols, or technology. If you can move a slider, you can use GELL-Y.

---

## ⚠️ Early Development

GELL-Y is at a very early stage. Right now it controls the four RGBW channels (Red, Green, Blue, and White) of any Z-RAY fixtures set to their default DMX address — so all your Z-RAYs respond together. A lot more is coming — but if you have a Z-RAY system and want to try it out, you're very welcome to.

Feedback is genuinely appreciated. If something doesn't work, or if something could be better, please [open an issue](../../issues) and let us know.

---

## What you need

- A **Think Radio Z-RAY** wireless DMX lighting system
- A **Think Radio STATION-X** — the wireless base station that plugs into your computer via USB and sends lighting commands to your Z-RAY fixtures wirelessly
- **Google Chrome** or **Microsoft Edge** — the app won't work in Firefox or Safari, sorry!
- A USB port on your computer

That's it.

---

## Getting started

1. Plug your STATION-X into your computer via USB
2. Turn the input selector on your STATION-X to **USB DATA IN**
3. Make sure your Z-RAY fixtures are in DMX MODE, and on the default channel. If you don't know how to do this, just press the **RESET** button, followed by the **RIGHT ARROW** button
4. Open the app in Chrome or Edge:

   👉 **[Open GELL-Y](https://dostr63.github.io/think-radio-gell-y/)**

5. Click **Scan** — your browser will ask which USB device to use, select the STATION-X
6. Move the sliders — your lights respond instantly

---

## What it does right now

- Controls the Red, Green, Blue, and White channels of all Z-RAY fixtures on their default DMX address
- Visual feedback showing each RGBW channel's colour and level in real time
- Blackout and Full ON buttons for instant control
- Works offline once loaded — take it to a gig with no internet and it still works
- Installable as an app on your desktop (click the install icon in your browser's address bar)

---

## What's coming

GELL-Y is being built toward something much more ambitious — a controller that makes the full power of the Z-RAY system available to anyone, without any technical knowledge. On the roadmap:

- A user interface that encourages exploration and experimentation
- Colour selection from colour wheels
- Easily configurable smooth sine-wave effects
- Perfectly sync'd and smoothed strobes with lots of configuration
- Sound-reactive effects, with lots of intuitive control
- User-controlled instantaneous tap and slider effects
- Ultra-smooth and precise colour and brightness levels (15 bit)
- Up to 8 individually-controllable Z-RAY groups, with any number of Z-RAYs in each group

And a free-form ability to mix any and all of these effects together.

---

## Browser support

Tested on Windows 10/11, macOS (Intel and Apple Silicon), and Linux (Ubuntu 24.04 / 26.04).

| Browser | Windows | macOS | Linux |
|---|---|---|---|
| ✅ Google Chrome | ✅ | ✅ | ✅ |
| ✅ Microsoft Edge | ✅ | ✅ | ✅ |
| ❌ Firefox | ❌ | ❌ | ❌ |
| ❌ Safari | ❌ | ❌ | — |

Chrome is the recommended browser on all platforms.

> **macOS Intel note:** Performance on older Intel Macs (pre-2019) and older macOS versions is still being evaluated. If you experience sluggish response, please [open an issue](../../issues) and let us know your Mac model and macOS version.

> **Safari / Firefox:** These browsers do not support the Web Serial API that GELL-Y relies on for USB communication. This is a browser limitation, not something GELL-Y can work around. Please use Chrome or Edge.

---

## Troubleshooting

### Linux — can select port but lights don't respond

Linux requires your user account to have permission to access USB serial devices. Run these two commands in a terminal, then **reboot** (a logout/login is not sufficient):

```bash
sudo usermod -a -G dialout $USER
sudo reboot
```

After rebooting, open GELL-Y in Chrome and try again. This is a one-time setup step.

> **Note:** If you installed Chromium as a snap package, you may also need to run:
> ```bash
> sudo snap connect chromium:raw-usb
> ```
> We recommend installing **Google Chrome** directly rather than snap Chromium, as it has full USB serial access without any additional configuration. Chrome for Linux (including ARM64) is available at [google.com/chrome](https://www.google.com/chrome/).

### The Scan button does nothing

- Make sure you are using Chrome or Edge — Firefox and Safari will not work
- Check your STATION-X is plugged in and the selector is set to **USB DATA IN**
- Try a different USB port or cable
- On Linux, make sure you've completed the `dialout` group fix above

### Lights connected but not responding to sliders

- Check your Z-RAY fixtures are powered on and within wireless range of the STATION-X
- Try clicking **Full ON** — if the lights respond to that but not the sliders, try a hard reload (`Ctrl+Shift+R`)
- Disconnect and reconnect using the Disconnect button, then Scan again

---

## About Think Radio

[Think Radio](https://thinkrad.io) makes Z-RAY — a wireless DMX lighting system designed for DJs, VJs, and live event professionals who want great lighting without the cable chaos. GELL-Y is the software companion to Z-RAY, built to be as simple and immediate as the hardware itself.

---

*GELL-Y is open source and in active development. Made with [p5.js](https://p5js.org).*
