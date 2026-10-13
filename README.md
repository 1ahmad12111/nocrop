# nocrop

A browser-based No Crop clone: fit a whole photo or video into an Instagram-sized frame with a blurred or solid-color background, so nothing gets cropped. Everything runs locally in the browser; files are never uploaded.

## Use it

```bash
npm start        # serves app/ at http://localhost:3000
npm test         # layout math unit tests
```

Or open `app/` with any static file server (ES modules don't load from `file://`).

## Features

- Sizes: 1:1, 4:5, 3:4, 9:16, 16:9, 1.91:1 (auto-picks the closest one on load)
- Background: blurred copy of the media (blur + darken), or a solid color
- Photo: size, position (drag the preview; double-click to center), rounded corners, border, shadow
- **Export at 4K** (e.g. 2160×2160, 2160×2700, 2160×3840) or 1080p
- Photos save as **lossless PNG** by default (JPEG at quality 100 optional), rendered from the full-resolution original
- Videos export with sound as MP4 (or WebM where MP4 recording isn't available)
- Share button on mobile (Web Share API)

### Limits

- Video is always re-encoded by the browser (MediaRecorder), so it can't be lossless; 4K uses a 60 Mbps target bitrate. 4K video needs a hardware encoder (recent Chrome/Edge/Safari on a normal computer or phone); if the encoder can't keep up, the app says so instead of saving a broken file.
- A source smaller than the export size is upscaled; the export panel warns when that happens.

## Reverse engineering with REA

This repo also ships the [REA](https://github.com/morluto/rea) skill (`.claude/skills/reverse-engineer-anything`, MIT) and registers its MCP server in `.mcp.json` (`npx -y rea-agents@6.4.0 mcp`). Claude Code sessions opened in this repo pick up both.
