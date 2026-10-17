# @kitafix/theme (shared)

Light/dark switch for the whole app. Not owned by one team: changes need a
group note (rule R10), like the app shell.

- Dark is the default; the choice is remembered per device (`localStorage` key `kf-theme`).
- Colours are the `--kf-*` tokens in `src/global.scss`. Use them in every module
  instead of raw colours, so both themes work without extra CSS.
- `ThemeService.mode()` (signal), `set('dark' | 'light')`, `toggle()`.

| Token | Use |
| --- | --- |
| `--kf-bg` | page background |
| `--kf-surface` | cards, bars, sheets |
| `--kf-surface-2` | inputs, chips, wells |
| `--kf-line` | borders, dividers |
| `--kf-text` / `--kf-muted` | main / secondary text |
| `--kf-accent` / `--kf-accent-soft` / `--kf-on-accent` | brand blue, its tint, text on it |
| `--kf-green` / `--kf-green-soft` | success, "go" actions |
| `--kf-danger` / `--kf-warn` | errors, warnings |
| `--kf-hero-from` / `--kf-hero-to` / `--kf-on-hero` | page header gradient and its text |
| `--kf-shadow` / `--kf-shadow-lift` | card shadow / raised things (menus, hover) |
| `--kf-violet`, `--kf-orange`, `--kf-pink`, `--kf-teal` (+ `-soft`), `--kf-warn-soft` | extra colours for icons and tints (variety, not meaning) |
| `--kf-ease`, `--kf-fast`, `--kf-slow` | animation curve and durations |

**Tones.** Put `data-tone="green"` (accent, green, orange, pink, violet, teal,
warn, muted) on an element and use `var(--tone)` / `var(--tone-soft)` inside it,
e.g. a coloured icon tile: `background: var(--tone-soft); color: var(--tone);`.

**Motion.** Shared keyframes: `kf-rise`, `kf-fade`, `kf-pop`, `kf-from-right`,
`kf-from-left`, `kf-drop`, `kf-shake`. Stagger a list with `style="--i: 2"` and
`animation-delay: calc(var(--i, 0) * 45ms)`. Use `backwards` (not `both`) as the
fill mode so `:active` transforms still work after the animation. Everything is
switched off for people who turn on reduced motion.
