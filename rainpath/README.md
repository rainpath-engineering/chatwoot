# RainPath patches on Chatwoot

This fork tracks Chatwoot releases. RainPath-specific changes are carried as
a single patch, `rainpath/patches/rainpath.patch`, so they can be re-applied
on each new release and dropped once upstream ships the same thing.

The patch is the full diff from the release commit to the fork branch
(`rainpath/vX.Y.Z`), this folder excluded. It holds two features, described
below. Both are off unless explicitly enabled, so applying the patch changes
nothing for an inbox or a page that does not opt in.

| Feature                              | Linear   | Enabled by                                |
| ------------------------------------ | -------- | ----------------------------------------- |
| Multiple conversations in the widget | RAI-4201 | an inbox setting                          |
| Link interception for the host page  | RAI-4261 | a `chatwootSettings` key on the host page |

The file was named `widget-multi-conversations.patch` until it carried a
second feature.

## Multiple conversations in the widget (RAI-4201)

### What it does

It lets a website visitor keep several conversations in the live chat widget
instead of being tied to the latest one:

- a Messages tab lists the visitor's conversations, newest activity first,
  with the last message and an unread count;
- the visitor can switch between conversations and start a new one at any
  time;
- campaigns also reach returning visitors, and each campaign click starts a
  new conversation;
- the backend gets `GET /api/v1/widget/conversations/list`, and the widget
  endpoints accept a `conversation_id` to act on a given conversation.

This part is the squash of upstream PR
[chatwoot/chatwoot#16002](https://github.com/chatwoot/chatwoot/pull/16002)
("feat: support multiple conversations in the widget", branch
`feat/CW-8283`, head `f9ddb12ab8`), plus four fixes for the review findings
left unresolved on that PR on 2026-09-30:

1. A list response requested before the SDK `setUser` switched the visitor
   could overwrite the new visitor's list and show the previous visitor's
   conversation previews. The list is now fenced by an identity counter and
   cleared on `setUser`.
2. With the setting off, `GET /api/v1/widget/conversations/list` still
   listed every older conversation. It now returns only the latest one, the
   conversation every other widget endpoint acts on when the setting is off
   (those endpoints already ignored `conversation_id` since `f9ddb12ab8`).
3. Resolving a conversation (including the one the widget opens in the
   background on load) cleared a campaign prompt it had nothing to do with.
   With the setting on, status changes no longer reset the prompt.
4. A conversation whose first load failed while offline stayed empty unless
   a socket reconnect followed, and reopening it did nothing. The failed load
   is now flagged and reopening the conversation retries it. Store-level
   specs also replay the reviewer's reconnect cursor scenario, fixed upstream
   by `f9ddb12ab8`.

It adds no database migration: the setting is bit 6 of the existing
`channel_web_widgets.feature_flags` column.

### The setting

Off by default. To enable it for a website inbox: Settings, Inboxes, pick
the inbox, Settings tab, "Widget features" section, then tick "Allow users
to have multiple conversations from the widget" and save.

With the setting off, the widget behaves as in the release: one
conversation, always the latest.

## Link interception for the host page (RAI-4261)

### What it does

It lets the page that embeds the widget handle clicks on links to its own
origins, for example to navigate a single page app to the linked screen
instead of opening it in a new tab:

- the host page lists origins in `window.chatwootSettings.linkInterceptOrigins`
  before the SDK runs;
- the SDK keeps only `https:` origins (plus `http://localhost` on any port,
  for development), each an origin and nothing more (no path, query string,
  fragment or credentials), and forwards the list to the widget with the
  `config-set` message;
- in the widget, one delegated click handler watches links inside incoming
  message content (agent and bot bubbles, `.chat-bubble.agent
.message-content`, where `MessageFormatter` renders links with
  `target=_blank`). A link whose origin is listed: the click is cancelled and
  the widget posts `{ event: 'onLinkClick', url }` to the SDK. Pressing Enter
  on a focused link dispatches the same click, so the keyboard behaves the
  same;
- the SDK checks the origin against the list again (any frame of the page
  can post to it) and dispatches on the host window
  `new CustomEvent('chatwoot:link-click', { detail: { url } })`.

Any other link keeps the release behaviour (a new tab), and with no list set
every link does. The host page stays responsible for validating the URL it
receives before acting on it.

```js
window.chatwootSettings = {
  linkInterceptOrigins: ['https://app.example.com'],
};
window.addEventListener('chatwoot:link-click', event => {
  const url = new URL(event.detail.url);
  // validate, then navigate
});
```

Code: `app/javascript/shared/helpers/linkInterceptHelper.js` (origin
validation, shared by both sides), `app/javascript/widget/helpers/linkInterceptHelper.js`
(click handler, installed by `widget/App.vue`), `appConfig` store
(`linkInterceptOrigins`), `sdk/IFrameHelper.js` (`onLinkClick`) and
`entrypoints/sdk.js` (the setting). No backend change, no migration.

## Applying it

From a clean checkout of the release tag:

```sh
git apply --3way rainpath/patches/rainpath.patch
```

## Rebasing it on a new release

1. Branch from the new release commit, for example
   `git switch -c rainpath/vX.Y.Z vX.Y.Z`.
2. Apply the current patch with `git apply --3way` (above) and resolve any
   conflict. Keep both sides when upstream changed the same specs, as was
   needed for `widget/store/modules/specs/conversation/helpers.spec.js` on
   v4.20.1 (`hasLeftConversation` from the PR, `groupConversationBySender`
   from the release).
3. Run the checks below, then commit.
4. Regenerate the patch against the new base, leaving this folder out:

   ```sh
   git diff --full-index vX.Y.Z HEAD -- . ':(exclude)rainpath' \
     > rainpath/patches/rainpath.patch
   ```

5. Check that it applies on a clean checkout of the release:
   `git apply --check rainpath/patches/rainpath.patch`.

Checks run on v4.20.1, with Postgres (pgvector) and Redis running for rspec
(the link interception has JavaScript specs only, under `sdk/specs`,
`shared/helpers/specs`, `widget/helpers/specs`, `widget/components/specs`
and the `appConfig` store specs):

```sh
pnpm test
bundle exec rspec spec/controllers/api/v1/widget spec/builders/campaigns \
  spec/models/channel/web_widget_spec.rb spec/models/message_spec.rb \
  spec/controllers/api/v1/accounts/inboxes_controller_spec.rb
pnpm exec eslint app/javascript/widget app/javascript/sdk \
  app/javascript/entrypoints/sdk.js app/javascript/shared/helpers
bundle exec rubocop app/controllers/api/v1/widget app/builders/campaigns
```

## When to drop it

Each feature is dropped on its own; once both are gone, delete the patch.

### Multiple conversations

Watch [chatwoot/chatwoot#16002](https://github.com/chatwoot/chatwoot/pull/16002).
Once it is merged and released, check that the release also covers the four
fixes listed above (or that the code they touch has changed), then remove
that part from the patch and its section here. If a fix is not
upstream yet, keep only that part as a smaller patch.

### Link interception

Not proposed upstream yet. Drop it if upstream ships an equivalent host
callback for message links, after switching the host page to it.
