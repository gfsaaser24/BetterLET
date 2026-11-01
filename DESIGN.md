# Design System: BetterLET

This file is the rule book. `styles.css` holds the tokens. If the two disagree, fix them in the same change.

## OG

A third choice on the same switch. It is the stock page: stock layout, stock pages, stock fonts, and no left sidebar. Our features sit on top: hover cards, Phosphor icons, the toolbar, the title opening the first post, the date and arrow jumping to the last comment, Thanks beside Quote, closed signatures, and Ctrl+Enter.

OG does not set `html.bl-on`, so no V1 or V2 layout applies. Its small layer is in `styles.css` under `html.bl-og`. Dark is the site's own dark mode, so changing theme or leaving OG reloads the page. Its gear sits in the green bar, left of the search box and level with it.

## Page numbers

Plain numbers with no boxes, in every design and theme. The current page is bold in the accent color. They always sit on their own row, clear of the cards above and below.

## Settings gear

One gear to the left of the search box, in every design. Its menu holds Design (OG, V1, V2), Theme (Auto, Light, Dark), and Signatures (Expanded, Collapsed). A check mark shows the current choice. Clicking an item applies it.

## Dashboard

`/discussions#dashboard`, linked in the top menu when signed in. It shows counts, then My threads and Bookmarks with new replies first. It only reads list pages, and it never opens the notifications page by itself.

## V2 trial

The design choice is in the settings gear. It is saved in `letBetter.design`. V2 matches LowEndBox: General Sans from Fontshare, 16px text, green `#05872f`, 2px corners, thin gray borders, a white page on mint, no glass, no rack rails, round avatars.

V2 is only a token and spacing layer at the end of `styles.css` under `html.bl-v2`. All markup and features are shared, so every new feature works in both. Sections below describe V1 unless they say otherwise. If V2 wins, its tokens become the base and the switch goes away.

## 1. The idea

**The rack.** LowEndTalk is where people buy and run small servers, so the forum reads like a server rack at night. The thread list is a rack: mounting rails down both sides, one thread per unit, and a status light on each unit. A lit light means you have not opened it, or it has new replies since you did.

- **Signature:** the rack rails and status lights. Nothing else competes with them.
- **Heritage:** green stays. It is the site's own colour, deepened and made tonal.

## 2. Hard rule: the ads

The site lives on ads. No rule may hide, shrink, cover or restyle anything in `#Panel`. The header stops before the ad column, so it never sits over an ad.

## 3. Colour

One family of tinted green neutrals and one accent. Never a cool blue charcoal, cream, or stock gray.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--bl-bg` | Page | `#eaf0e8` | `#0a0f0b` |
| `--bl-surface` | Rows, panels | `#f7faf5` | `#111813` |
| `--bl-surface2` | Hover, quotes, controls | `#e1e9de` | `#18211a` |
| `--bl-line` | Self-coloured edges | `rgba(23,61,39,.14)` | `rgba(190,235,200,.11)` |
| `--bl-ink` | Main text | `#14231a` | `#e4efe5` |
| `--bl-muted` | Secondary text | `#4d5f53` | `#93a697` |
| `--bl-accent` | Links, active items | `#1c6b3f` | `#8fdca4` |
| `--bl-led` | Status light | `#1f9d57` | `#6fe08f` |
| `--bl-danger` | Form errors only | `#a3341f` | `#f0a08a` |
| `--bl-field` / `--bl-field-line` | Form fields and their border | `#fff` / `rgba(23,61,39,.34)` | `#0d1310` / `rgba(190,235,200,.24)` |
| `--bl-fill` / `--bl-on-fill` | Primary button | `#173d27` / `#e9f5ea` | `#c9f0cf` / `#0b140e` |

- Body text is at least 4.5:1 on its surface in both themes.
- Colour carries state. It is never decoration.
- Categories are plain text, not coloured pills.

## 4. Theme

Three modes: Auto, Light, Dark. Auto follows the system. The choice is saved in `letBetter.theme`. The control is a text segmented switch in the header, never a sun and moon toggle. The site's moon button is hidden so there is one control. `early.js` keeps the site's own dark mode off in V1 and V2, because its pale text breaks our light themes. OG uses it.

## 5. Type

| Role | Face | Use |
|---|---|---|
| Display and numbers | Bahnschrift, then DIN Alternate, then system | Logo, page titles, counts, column labels |
| Text | Segoe UI Variable, then system-ui | Titles in rows, posts, controls |

Bahnschrift is the DIN face printed on real equipment, and it ships with Windows, so no font files are added.

| Size | Px | Use |
|---|---|---|
| Page title | 24 | `h1`, tracking -0.01em |
| Post text | 15 | Line height 1.6, max 76ch |
| Row title | 14 | Weight 600 |
| Control | 13 | Buttons, rail links |
| Meta | 12 | Secondary row text |

Numbers use `tabular-nums`. Mono is only for code.

## 6. Space, shape, depth

- **Space:** 4px base: 4, 8, 12, 16, 20. Rows are dense. Page gutters are 20.
- **Radius:** 12 for containers, 7 for controls, 4 for avatars.
- **Depth:** tone and self-coloured edges first. One tight shadow is allowed on the glass only. No hover lift, no glow, no halo.

## 7. Glass

Glass is allowed on two parts only: the header island and the list toolbar. Both are sticky, and real content scrolls under them. Never stack glass on glass.

Recipe: `--bl-glass` fill, `blur(18px) saturate(160%)`, inset top highlight, tight shadow. Under `prefers-reduced-transparency` or without `backdrop-filter`, use a solid surface.

## 8. Components

- **Header island:** floating, rounded, sticky. Logo, nav, search, theme switch. One line.
- **Left rail:** account, New Discussion, Quick Links, Categories, thread people. Sticky, and it scrolls on its own. The account box sits outside the scroll so its flyouts are not clipped.
- **Rack list:** rails on both sides. Each row has three lines: title, then category, author and new count, then last comment by, date and time, and a jump arrow. Columns: replies, views, started.
- **Status light:** lit = not opened, or new replies since. Hollow = opened and nothing new. It is state, so it is allowed. It does not pulse or glow. The forum's own read flag does not count.
- **Last comment line:** the title opens the first post. The date and the arrow open the last comment, with its whole card below the header. Bold when there are replies you have not seen. A thread with no replies says so.
- **Settings pages:** one card, max 680 wide. Label above input. One primary Save button. Notification choices are switches drawn on the real checkboxes, so the form is unchanged.
- **Hide seen:** hides opened threads only. Your own threads always stay.
- **Categories:** the same rack. Name, description, threads, replies, latest post. Subcategories join their parent with a curved connector. The whole row is a link.
- **Profile:** one header card. Small avatar, name, edit button, then a spec plate of label over value. Empty warnings are one fact on the plate, not a section.
- **Composer:** one system on new thread, full reply, comment box, message pages, and post edits. Card with 16 padding, label above field, 38 tall inputs, 15px text. Every action button is 36 tall at 14px. Way out on the left, then Preview, Save Draft, and the main action last on the right. Settings pages keep Save on the left under their short forms.
- **Polls:** one card inside the post, with the same bar fill for every option. The plugin's rainbow colors and arrow images stay off. Add a Question and Add an Option are plain buttons.
- **Primary button:** `--bl-fill`. One per view. All other buttons use `--bl-surface2`.
- **Pop-out menus:** 12 radius, 4 padding, rows with 8 radius. Scale in from the top left. No arrow on the account menus.
- **Hover cards:** one shared `#bl-pop` for people. Cards open after 350ms. The card stops at the ad column, so it never covers an ad. Skeleton while loading. Outside text is always plain text, never HTML. People cards never show email.
- **Comment boxes:** Ctrl+Enter or Cmd+Enter sends a comment or message reply. It never sends an empty box.
- **Thanks:** the site's link moves from the date line to the button row beside Quote. The site gives no Thanks link on your own posts, or on one you already thanked.
- **Thread:** posts on `--bl-surface`. Signatures follow the gear setting and are expanded by default. Thanks names stay closed until clicked.

## 9. Motion

Easing: `cubic-bezier(.16,1,.3,1)`. All content is visible by default. Motion never reveals content.

| Moment | What moves | Time |
|---|---|---|
| Row hover | Title and light slide 3px, like a unit pulled from the rack | 240ms |
| Row press | Row scales to .996 | 100ms |
| Sort or filter | Rows glide to their new place (FLIP) | 420ms |
| Theme change | Switch thumb slides, one page-wide crossfade (View Transition) | 260ms |

Never fade colours element by element. That lags on a page this size.

**Page load.** The page stays hidden only until `content.js` finishes, so the old layout never flashes. A thin ring shows only if that takes over 250ms. Most loads show no spinner. A CSS timer reveals the page at 3s even if our script fails.

`prefers-reduced-motion` removes all of it. Buttons never move on hover.

## 10. Layers and icons

**Layers.** Use only these tokens. Never write a raw `z-index`.

| Token | Value | Part |
|---|---|---|
| `--bl-z-bar` | 20 | List toolbar |
| `--bl-z-rail` | 30 | Left rail, so its flyouts open over the toolbar |
| `--bl-z-foot` | 35 | Footer, so the rail slides under it |
| `--bl-z-head` | 40 | Header island |
| `--bl-z-flyout` | 60 | Menus in the content column |
| `--bl-z-pop` | 70 | Hover cards |

- The rail must not move when the page gets taller. Its row reaches behind the footer, so the comment box never drags it.
- Never put `overflow: hidden` on a box that holds a flyout. It cuts the menu off.
- After any layout change, open the account menus and a row menu, then check they sit on top and are whole.

**Icons.** Phosphor, regular weight, one family only. `tools/icons.py` pulls them from jsDelivr at a pinned version and writes them into `styles.css`. The plugin makes no CDN requests. To add an icon, add it to that script and run it. Icons are masks tinted by theme tokens, never image colours.

## 11. Screen sizes

Older, low resolution screens matter most. No page may scroll sideways at any width.

| Width | Layout |
|---|---|
| Over 1400 (V2: over 1500) | Rail, content, ads. Sticky header island beside the ads |
| 1280 to 1400 | Rail, content, ads. Header spans the page above the ads and is not sticky |
| 1041 to 1279 | Narrow rail, content, ads. Same header |
| 641 to 1040 | One column: compact rail, content, ads at full size. Header wraps |
| 640 and under | Same, tighter. Rack rails and list labels drop |

Columns drop as space runs out: Views at 1300, Started at 1180. On Categories: Replies at 1300, Latest at 1180. Ads never shrink.

## 12. Browser surfaces

Text selection, caret, scrollbars, focus rings and `mark` highlights all use the tokens. Keyboard focus shows a 2px accent ring.

## 13. Never do

- Hide or cover ads.
- Change links, form names or action URLs.
- Use purple, blue charcoal, cream, or gradients on text.
- Use pills around metadata, eyebrow labels, or section numbers.
- Use glow, halos, hover lift, or pulsing dots.
- Use a sun and moon toggle.
- Use em dashes in any text we add.
- Hide content behind an animation.
- Add a third glass surface.

## 14. Check before shipping

- Both themes viewed on list, categories, thread, profile, settings, search and post pages.
- Contrast audit run on form pages with the site's dark styles forced on, as a worst case.
- Tested with `styles.css` loaded before the site's CSS, as the real plugin does. Site rules with an ID or `!important` can beat ours, so check them.
- No sideways scroll at 1920, 1366, 1280, 1024, 800 and 375 wide.
- All ads visible at full size.
- Contrast passes in both themes.
- All flyouts open on top and whole.
- Reduced motion and reduced transparency work.
- `styles.css` tokens match this file.
