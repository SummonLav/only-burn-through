# Only Burn Through

**English** · [简体中文](README.zh-CN.md)

Flame transitions and distressed typography. A small, playful tool in the Only series.

## Start with the skill

Attach your concert clips and paste this into Codex:

```text
Install the skill from https://github.com/SummonLav/only-burn-through/tree/main/skills/theweeknd-highlights, then use $theweeknd-highlights to turn my clips into a 45-second vertical highlight video with flame transitions. Keep the live audio and leave subtitles off.
```

Once installed, just ask `$theweeknd-highlights` to edit your next clips. Defaults: **45 seconds · 720 × 1280 · 30 fps · no subtitles**. Ask explicitly to add song titles on musical accents.

Video editing runs locally and requires Python 3, Node.js, FFmpeg/FFprobe, and Chrome or Playwright Chromium. The skill sets up its own Python and Node dependencies. [Skill guide](skills/theweeknd-highlights/SKILL.md) · [Configuration](skills/theweeknd-highlights/references/configuration.md)

## Try it in your browser

[**Open the studio →**](https://only-burn-through.vercel.app)

- **[Flame transition](https://only-burn-through.vercel.app):** scrub, replay, and tune duration, flame width, core width, and glow.
- **[Typography](https://only-burn-through.vercel.app/typography):** edit red stencil lettering, adjust wear and distortion, and export a transparent PNG.
- **[Burn-through intro](https://only-burn-through.vercel.app/opening):** watch a title burn away as the next image appears.

English by default; switch to 中文 in the header. No account or API key needed. The web studio previews effects; the skill edits your local videos.

![Blue-to-red flames revealing a gold portrait](public/preview/flame.png)

## Examples

**Flame transitions · no subtitles (default)** — 45 seconds, live audio, fireworks finish.

https://github.com/user-attachments/assets/05bc28b8-9e71-43b9-bded-33a23b5897cf

<details>
<summary>Typography and optional song titles</summary>

**Typography** — 6 seconds of distressed red lettering.

https://github.com/user-attachments/assets/369d4c6f-e119-482d-adf6-df0ecbbdd9f9

**With song titles** — 45 seconds, titles timed to musical accents.

https://github.com/user-attachments/assets/a184b2df-3938-49c5-a301-4005ed6353c4

</details>

## Run locally

```sh
git clone https://github.com/SummonLav/only-burn-through.git
cd only-burn-through
npm ci
npm run dev
```

Open [localhost:3017](http://localhost:3017). Built with Next.js, TypeScript, WebGL, and GSAP. Space plays or pauses; R replays flame and intro scenes. Reduced-motion preferences are respected.

<details>
<summary>Manual skill installation and development checks</summary>

From the cloned repository, copy the self-contained skill to your Codex skills directory:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/theweeknd-highlights "${CODEX_HOME:-$HOME/.codex}/skills/"
```

Use your own footage paths in the [example configuration](skills/theweeknd-highlights/references/the-weeknd-example.json).

```sh
npm run typecheck
npm run build
```

</details>
