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
| `--kf-shadow` | card shadow |
