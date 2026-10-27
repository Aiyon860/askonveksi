# Hyperframes Composition Brief: Askonveksi

## Objective
Create a short launch-style brag video for Askonveksi.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: the Askonveksi repo
- Primary files read: `README.md`, `package.json`, `app/page.tsx`, `app/globals.css`, `DESIGN.md`, `components/app-nav.tsx`, `lib/cms/seed-content.json`, `lib/crm/constants.ts`, `lib/production/workflow.ts`
- Product name: Askonveksi
- Tagline / strongest claim: "Konveksi di Semarang untuk Seragam dan Apparel Custom" and the process overlay "Dari Desain / Hingga Siap Pakai"
- Key UI or visual moment to recreate: Kotak Masuk bubble, Pipeline columns (Follow Up, Negosiasi, Deal), Produksi columns (Potong, Jahit, QC, Selesai)
- Copy that must appear verbatim:
  - Kotak Masuk
  - Pipeline
  - Follow Up
  - Negosiasi
  - Deal
  - Produksi
  - Non-Jersey
  - Potong
  - Jahit
  - QC
  - Selesai
  - Konveksi di Semarang
  - Askonveksi
  - Dari Desain
  - Hingga Siap Pakai
- Stand-in copy (not a real order): "Satu chat." "Butuh 120 seragam dinas." "Seragam Dinas" "120 pcs"

## Creative Direction
- Tone preset: polished
- Creative direction: quiet factory control room
- Interpretation: soft crossfades, Inter only, one blue accent, white cards on `#eff3f7`, no generic SaaS lines
- Angle: one order walks Kotak Masuk → Pipeline → Produksi, then the site's own closing line
- Hook: the incoming bubble
- Outro / punchline: Dari Desain / Hingga Siap Pakai
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Phone numbers, emails, real customer names
  - The black-square logo file (it is a black plate; use the Inter wordmark)
  - Painting many panels blue

## Visual Identity
- Background: `#eff3f7`
- Text: `#0a0a0a`
- Accent: `#0053c2`
- Card: `#ffffff`, line `#e5e5e5`, radius 10px
- Success: `#e0fce5` / `#104020`
- Muted: `#5d5d5d`
- Display font: Inter
- Body font: Inter
- Visual references from the project: operate canvas, white work cards, blue only on the kicker and the quantity, success tint only on Selesai

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Kotak Masuk — 4.64s — bubble "Butuh 120 seragam dinas."
2. Pipeline — 5.19s — card steps Follow Up, Negosiasi, Deal
3. Produksi — 6.55s — card steps Potong, Jahit, QC, Selesai; success tint at 15.82s
4. Siap pakai — 4.62s — Askonveksi / Dari Desain / Hingga Siap Pakai

## Audio
- Audio role: warm bed
- Audio arc: bed in at the start, UI ticks on motion, bed out on the wordmark hold
- Music: `assets/music/bed.mp3` (trimmed from happy-beats-business-moves-vol-10, fade in 0.45s, fade out from 19.6s)
- Music treatment: data-volume about 0.34; fades are already in the file
- Music cue guidance: bundled vol-10 preset. Lock 15.82s and 18.01s. Card steps on 6.82, 8.22, 11.47, 12.56, 13.64.
- Audio-reactive treatment: subtle; bass band scales and lifts a single blue glow. No waveform.
- Audio-coupled moments:
  - bubble — click
  - card steps — rollover
  - Selesai tint — soft impact
  - wordmark — soft bong
- SFX selection guidance: low high-frequency risk only (`click_003`, `rollover2`, `impactSoft_medium_001`, `bong_001`)
- SFX analysis guidance: `.agents/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: those four files, copied under `composition/assets/sfx/`
- Audio files: music and SFX live in `brag-output/composition/assets/`

## Hyperframes Instructions
Single composition `index.html`, 1920×1080, 21.0s. Blur crossfades between scenes (scene containers only). No element exits except the final fade. Entrance tweens use mixed eases and directions. Beat-lock comments in the timeline. Audio-reactive sampling uses `assets/music/audio-data.js`. Colors are hex because contrast sampling must see them. `npx hyperframes check` is the gate before render.
