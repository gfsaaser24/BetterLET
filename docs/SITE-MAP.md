# LowEndTalk site map

Mapped 2026-10-31 from a logged-in Member account (read-only). No forms were sent.

## What the site is

- **Software:** Vanilla Forums 3.3 (server-rendered PHP, jQuery, some React bundles).
- **Theme:** `themes/lowendnew` (`style.css`, `custom.css`, `tag.css`, `sprites.css`).
- **Plugins seen:** Editor, Signatures, IndexPhotos, Spoilers, Tagging, ThankFor, DiscussionPolls (`DP_*` fields), Quotes.
- **Ads:** BuySellAds plus a hand-built `.let-sidebar-stack` of image tiles.
- **Other:** Cloudflare in front, reCAPTCHA, Google Analytics.
- **Layout:** fixed 1080px frame, 740px list column, 260px sidebar. It does not use extra screen width.

## Page shell (every page)

```
#Frame
  #Head.Head          green top bar: logo, nav, search
  #Body > .Row
    .Column.ContentColumn   main column
      .Tabs.DiscussionTabs  breadcrumb / tabs
      #content              page content
    .Panel                  sidebar
  #Foot
```

There is no `#Content` element. Use `.Column.ContentColumn` or `#content`.

Target a page with `body#id`. Target a category with the body class `Category-<slug>`. A body class of `NoPanel` means the page has no sidebar. `isDesktop` is on the body, so check for a mobile variant before relying on it.

### Top nav

LowEndTalk (home), LowEndBox (external), Discussions, Mark All Viewed (**action, not a page**), Categories, Rules (Community Rules, Selling Rules), Contact Us (support.lowendtalk.com). The footer links LowEndBox, ServerVerify, Advertise, Dark Theme Settings.

### Sidebar blocks (`.Panel`), top to bottom

| Block | Selector | What it does |
|---|---|---|
| Account box | `.MeBox` | Avatar, name, flyouts: notifications, inbox, bookmarks, options, theme toggle |
| New Discussion | `.BoxNewDiscussion` | Opens the composer |
| Quick Links | `.BoxDiscussionFilter` | Categories, Recent, My Bookmarks, My Discussions, My Drafts |
| Ads (BSA) | `.bsarocks`, `.bsap` | Ad grid |
| Ads (tiles) | `.let-sidebar-stack` > `.let-sidebar-tile` | About 6,000px tall on a list page |
| Categories | `.BoxCategories` | Collapsed by default, below all the ads |
| Thread only | `.BoxInThisDiscussion` | People in this thread |
| Message only | `.InThisConversation`, `.AddPeople` | People in this conversation |

## Public pages

| URL | `body#id` | What it is |
|---|---|---|
| `/`, `/discussions` | `vanilla_discussions_index` | All recent threads. 104 rows at last check, 5 of them pinned, paged |
| `/discussions/unread` | `vanilla_discussions_unread` | Unread threads |
| `/categories` | `vanilla_categories_index` | Category list with descriptions and latest post |
| `/categories/all` | `vanilla_categories_all` | Category list, same content |
| `/categories/<slug>`, `/p2` | `vanilla_categories_index` | One category. Body class `Category-<slug>` |
| `/discussion/<id>/<slug>/p<n>` | `vanilla_discussion_index` | Thread. First post, comments, reply box |
| `/discussion/comment/<id>` | redirects | Link to one comment |
| `/search?Search=<term>` | `dashboard_search_index` | Search. Text box and a flat list. No filters. No sidebar blocks |
| `/page/dark-theme-config` | `basicpages_page_index` | Dark theme colour settings |
| `/post/discussion/<category>` | `vanilla_post_discussion` | New thread composer |

Feeds: `/discussions.rss` and `/categories/<slug>/feed.rss` both work.
Sitemap: `/sitemapindex.xml` (15 per-category sitemaps).

### Categories

Indented names are subcategories. Counts are threads.

| Slug | Name | Threads |
|---|---|---|
| `announcements` | Announcements | 161 |
| `meta` | &nbsp;&nbsp;Meta | 52 |
| `general` | General | 29.4K |
| `offers` | Offers | 16.6K |
| `shared-hosting-offers` | &nbsp;&nbsp;Shared Hosting Offers | 1.9K |
| `industry-news` | Providers | 5.9K |
| `outages` | &nbsp;&nbsp;Outages | 975 |
| `domains` | Domains | 3.3K |
| `giveaways-freebies` | Giveaways & Freebies | 105 |
| `help` | Help | 13.8K |
| `news` | News | 663 |
| `security` | &nbsp;&nbsp;Security | 24 |
| `reviews` | Reviews | 2.4K |
| `requests` | Requests | 18.4K |
| `service-transfers` | Service Transfers | 1.4K |
| `tutorial` | Tutorials | 723 |
| `offtopic` | Offtopic | 9.2K |

The slug `industry-news` shows as "Providers". Total: 106.1K threads.

## Account pages

| URL | `body#id` | What it is |
|---|---|---|
| `/profile`, `/profile/<name>` | `dashboard_profile_index` | Profile and activity wall |
| `/profile/activity/<name>` | `dashboard_profile_activity` | Activity wall with a post box |
| `/profile/notifications` | `dashboard_profile_notifications` | Notification list |
| `/profile/receivedthanks/<name>/` | | Thanks you received |
| `/profile/discussions/<name>` | `dashboard_profile_discussions` | Threads by a user |
| `/profile/comments/<name>` | `dashboard_profile_comments` | Comments by a user |
| `/profile/invitations` | `dashboard_profile_invitations` | Invitations |
| `/profile/connections` | `dashboard_profile_connections` | Linked social accounts |
| `/discussions/mine` | `vanilla_discussions_mine` | My threads |
| `/discussions/bookmarked` | `vanilla_discussions_bookmarked` | My bookmarks |
| `/drafts` | `vanilla_drafts_index` | My drafts |

### Settings (side menu `.SideMenu`)

| URL | `body#id` | Form fields |
|---|---|---|
| `/profile/edit` | `dashboard_profile_edit` | Username (locked), Email, ShowEmail, birthday, hosting provider questions |
| `/profile/password` | `dashboard_profile_password` | OldPassword, Password, PasswordMatch |
| `/profile/preferences` | `dashboard_profile_preferences` | Email and Popup checkboxes for 7 events (below) |
| `/profile/picture` | `dashboard_profile_picture` | Avatar upload, thumbnail crop |
| `/profile/signature` | `dashboard_profile_signature` | Body, HideAll, HideMobile, HideImages |
| `/profile/quotes` | `dashboard_profile_quotes` | QuoteFolding |

Notification events: WallComment, ActivityComment, ConversationMessage, DiscussionComment, BookmarkComment, Mention, ParticipateComment.

## Private messages

| URL | `body#id` | What it is |
|---|---|---|
| `/messages/inbox`, `/messages/all` | `conversations_messages_inbox`, `_all` | Conversation list |
| `/messages/<id>` | | One conversation. Sidebar has New, Leave, people list, Add People |
| `/messages/add` | `conversations_messages_add` | New message. `NoPanel` |

Rows: `li.Item.HasPhoto` (`.Read` when read).

## Admin and blocked pages

| URL | Result |
|---|---|
| `/settings`, `/settings/home`, `/dashboard/settings`, `/dashboard/user`, `/dashboard/role`, `/vanilla/settings`, `/user` | 401. Staff only |
| `/activity` | 401 for this account |
| `/profile/tokens` | 401 for this account |
| `/dashboard` | 404 |

Staff pages cannot be mapped with a Member account. They exist but the plugin will never see them for this user.

Pages that do not exist (404): `/best`, `/tags`, `/members`, `/moderators`, `/online`, `/help`, `/badges`, `/discussions/participated`, `/discussions/popular`, `/discussions/tagged/<tag>`, `/profile/ignore`, `/profile/thanks/<name>`.

## Action URLs. Never fetch these in the background

A GET on these changes something:

| URL | Effect |
|---|---|
| `/discussions/markallviewed` | Marks everything read |
| `/category/markread?categoryid=<id>&tkey=<key>` | Marks a category read |
| `/discussion/bookmark/<id>/<key>` | Toggles a bookmark |
| `/plugin/thankfor/comment/<id>`, `/plugin/thankfor/discussion/<id>` | Sends thanks |
| `/discussion/flag/...` | Opens the flag form |
| `/vanilla/discussion/dismissannouncement?discussionid=<id>` | Dismisses a pinned thread |
| `/profile/removepicture/<name>?tk=<key>` | Deletes your avatar |
| `/entry/signout?TransientKey=<key>` | Logs out |

Any link with a 16-character key is an action. Do not log that key.

## DOM reference

### Thread row (`li.ItemDiscussion`, in `ul.Discussions`)

```
li#Discussion_<id>.Item.ItemDiscussion   + Read / Unread / Announcement / Closed / New / Alt
  a.IndexPhoto.PhotoWrap
  span.Options > a.Hijack.Bookmark
  .ItemContent.Discussion
    .Title > a                           href ends in #latest
    .Meta.Meta-Discussion
      .DiscussionAuthor  .ViewCount  .CommentCount  .DiscussionScore.Hidden
      .HasNew.NewCommentCount  ("3 new" badge, + .JustNew)
      .LastCommentBy  .LastCommentDate > time[datetime]
```

On `/discussions`, rows also have `.MItem.Category.Category-<slug>`. The list row has no thread start date. The thread id rises with age, so it can sort by creation.

### Thread page (`.MessageList.Discussion`)

```
#Item_0.PageTitle > .Options, h1
#Discussion_<id>.ItemDiscussion.Role_<Role>
  .Item-Header  .Author  .AuthorInfo .RoleTitle
  .DiscussionMeta  .DateCreated time  .DateUpdated  .Category  .CommentFlag  .Thank
  .Message.userContent
  .ThankedByBox
  .Signature.UserSignature
.CommentsWrap > ul.MessageList.DataList.Comments
  li#Comment_<id>.ItemComment.Role_<Role>   same shape with .CommentMeta
.Pager
.CommentForm
```

`.ThankedByBox` lists every name, up to 147 links on one post. Role classes are on the row, for example `Role_Administrator`, `Role_TopHost`, `Role_HostRep`, `Role_PatronProvider`, `Role_Veteran`.

### Composer

Fields: Name (title), Body, category, Post Discussion, Save Draft, Preview. Poll fields: `DP_Title`, `DP_Questions[]`, `DP_Options0[]`, `DP_Attach`. Toolbar: `.editor-action` and `.editor-dropdown`: bold, italic, strike, lists, headings, blockquote, code, spoiler, emoji.

### Search row

```
li.Item.Item-Search
  h3 > a                      link to the comment or thread
  .Media-Body .MItem-Author .MItem-DateInserted .Summary
```

### Category row

`li#Category_<id>.Item.Depth1|Depth2.Unread`, with `.TitleWrap .Title`, and an options flyout holding Mark Read.

## Data sources

| Source | Status | Use |
|---|---|---|
| Page HTML | Works | Main source |
| `/api/v2/categories` | Works, JSON | Category tree |
| `/api/v2/discussions` | Blocked by Cloudflare (403) | Cannot use |
| `/api/v2/comments` | Blocked by Cloudflare (403) | Cannot use |
| `/api/v2/users/$me` | 404 | Cannot use |
| RSS | Works | Newest threads, no login needed |
| `localStorage` | Plugin only | Our saved state |

## Layout problems seen

1. **Wasted screen.** Fixed 1080px on a wide screen. Solid lime green page sides.
2. **Ads own the sidebar.** About 6,000px of ads. 92 ad elements on one list page. Useful links sit above them, and Categories sit below them, collapsed.
3. **Very long lists.** 100 rows make a page about 5,800px tall. Rows are loose, and the data lines are small and low contrast.
4. **Rows hide key data.** No thread start date. Category is a small text item at the end of the line. Pinned rows take the top of the list. View and reply counts are buried in a text line.
5. **Bad text hierarchy.** Green links for everything. Titles, metadata and badges do not stand apart.
6. **Thread noise.** Long signatures and giant "Thanked by" name lists on each post.
7. **Search is weak.** No filters by category, author, date, or thread vs comment. Duplicate thread titles for each matching comment.
8. **Settings are thin and ugly.** Six separate small forms. Half the page is empty, next to a tall ad column.
9. **Notifications are scattered.** Bell flyout, full page, and activity wall are separate. Inbox is a separate area again.
10. **Dark theme is manual.** A setup page with hex codes, not a clean toggle. Our CSS must work in both modes.
11. **Actions are risky.** "Mark All Viewed" sits in the main nav with no confirm.

## Rules for plugin changes

- Style with CSS first. Scope it by `body#id`.
- Keep all ads visible and clickable. The site lives on them. Do not hide, shrink or cover them.
- Do not fetch action URLs. Do not submit forms in the background.
- Keep requests slow. Cloudflare blocks some paths, so back off on a 403 or 429.
- Fetching a thread may add a view and change read state. The current start-date loader does this for every row you scroll past. Review it before we build on it.
- Run on `document_start` for CSS changes, so the old layout does not flash.
- Support light and dark themes.
- Do not change the page behaviour of the composer or the forms. They depend on jQuery handlers.
