"""Pull Phosphor icons from the CDN and write them into styles.css as inline masks.

Run from the repo root: python tools/icons.py
The icons ship inside styles.css, so the plugin makes no CDN requests.
"""
import re
import urllib.parse
import urllib.request

VERSION = '2.1.1'
BASE = f'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@{VERSION}/assets'

# selector -> (icon, weight)
ICONS = {
    '.SpNotifications': ('bell', 'regular'),
    '.SpInbox': ('envelope-simple', 'regular'),
    '.SpBookmarks': ('bookmark-simple', 'regular'),
    '.SpOptions': ('gear-six', 'regular'),
    '.SpAllCategories': ('squares-four', 'regular'),
    '.SpDiscussions': ('chats-circle', 'regular'),
    '.SpMyDiscussions': ('chat-circle-text', 'regular'),
    '.SpMyDrafts': ('note-pencil', 'regular'),
    '.SpActivity': ('pulse', 'regular'),
    '.SpComments': ('chat-text', 'regular'),
    '.SpEditProfile, html.bl-on .SpEdit': ('pencil-simple', 'regular'),
    '.SpPassword': ('lock-key', 'regular'),
    '.SpPreferences': ('sliders-horizontal', 'regular'),
    '.SpPicture': ('image', 'regular'),
    '.SpSignatures': ('signature', 'regular'),
    '.SpQuote': ('quotes', 'regular'),
    '.SpMessage': ('paper-plane-tilt', 'regular'),
    '.bl-gear-icon': ('gear-six', 'regular'),
    '.bl-menu button[aria-checked="true"]::after': ('check', 'bold'),
    '.ReactQuote': ('quotes', 'regular'),
    '.Reactions .Thank > a::before': ('heart', 'regular'),
    '.Reactions .UnThank > a::before': ('heart', 'fill'),
    '.OptionsTitle': ('dots-three', 'bold'),
    '.bl-go': ('arrow-right', 'bold'),
    'a.Bookmark': ('bookmark-simple', 'regular'),
    'a.Bookmark.Bookmarked, html.bl-on .Bookmarked a.Bookmark': ('bookmark-simple', 'fill'),
    '.SiteSearch input[type="submit"]': ('magnifying-glass', 'regular'),
}


def fetch(name, weight):
    file = name if weight == 'regular' else f'{name}-{weight}'
    req = urllib.request.Request(f'{BASE}/{weight}/{file}.svg', headers={'User-Agent': 'betterlet-icons'})
    with urllib.request.urlopen(req) as res:
        return res.read().decode('utf8').strip()


lines = [f'/* ICONS START: Phosphor {VERSION}. Made by tools/icons.py. Do not edit by hand. */']
for selector, (name, weight) in ICONS.items():
    uri = 'data:image/svg+xml,' + urllib.parse.quote(fetch(name, weight), safe="/:=' ")
    url = 'url("' + uri + '")'
    both = f'html.bl-on {selector}'
    # OG uses the same icons, but keeps the stock search button.
    if 'SiteSearch' not in selector:
        both += ', ' + both.replace('html.bl-on', 'html.bl-og')
    lines.append(f'{both} {{ -webkit-mask-image: {url}; mask-image: {url}; }}')
lines.append('/* ICONS END */')

path = 'styles.css'
css = open(path, encoding='utf8').read()
block = '\n'.join(lines)
css, count = re.subn(r'/\* ICONS START.*?ICONS END \*/', lambda _: block, css, flags=re.S)
if count != 1:
    raise SystemExit('Icon markers not found in styles.css')
open(path, 'w', encoding='utf8', newline='\n').write(css)
print(f'Wrote {len(ICONS)} icons')
