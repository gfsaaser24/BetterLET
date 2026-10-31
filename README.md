<p align="center">
  <img src="docs/media/icon128.png" width="96" alt="BetterLET icon">
</p>

<h1 align="center">BetterLET</h1>

<p align="center">
  <strong>LowEndTalk, rebuilt in your browser.</strong><br>
  A Chrome extension that gives the forum a real layout, real scanning, and two real themes.<br><br>
  Works in all chromium based browsers.
</p>

<p align="center">
  <img src="docs/media/before-after.gif" width="640" alt="Wipe from the stock LowEndTalk thread list to BetterLET">
</p>

## What changed

**Thread list**
- Status lights show what you have not opened, or what has new replies.
- Rows have three lines: title, category and author, then last comment with date and time.
- The title opens the first post. The date and arrow jump to the last comment.
- Sort by newest reply, newest thread, oldest thread, or most replies.
- Hide seen threads and pinned threads. Your own threads always stay.
- Load the next page in place, and mark all seen.

**Threads**
- Signatures and long "Thanked by" lists stay closed until clicked.
- Each thread shows when it started and its last comment.
- Thanks sits beside Quote as a button on every post.
- Links to other sites open in a new tab.
- Ctrl+Enter sends a comment or message reply.

**Layout**
- Wider layout with a left sidebar that stays in place.
- Works on wide screens, older laptops, small windows, and phones.
- Auto, Light, and Dark themes.
- A gear beside the search box holds design and theme.
- A Dashboard page shows your counts, threads, and bookmarks.
- Three designs to compare: OG keeps the original layout and fonts with no sidebar, V1 is a server rack, and V2 matches LowEndBox.

**Pages and details**
- Rebuilt Categories, Profile, and all six settings pages.
- User hover cards show roles, join date, activity, and thanks.
- New pop-out menus and Phosphor icons.
- Fixed search bar, plus a spinner that shows only on slow loads.
- Mark All Viewed asks first.

## Install

1. Download this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder with `manifest.json`.
4. Open [LowEndTalk](https://lowendtalk.com/categories/requests).

To update, pull the latest code and click reload on the BetterLET card.

## Privacy

BetterLET asks for no extra browser permissions. Your settings stay in your browser. V2 loads its font from Fontshare.

## Development

Plain JavaScript and CSS, with no build step. Read [DESIGN.md](DESIGN.md) before changing anything visual.

## License

[MIT](LICENSE)
