# RainPath patches on Chatwoot

This fork tracks Chatwoot releases. RainPath-specific changes are carried as
patches in `rainpath/patches/`, so they can be re-applied on each new release
and dropped once upstream ships the same thing.

## `widget-multi-conversations.patch` (RAI-4201)

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

The patch is the squash of upstream PR
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

The patch adds no database migration: the setting is bit 6 of the existing
`channel_web_widgets.feature_flags` column.

### The setting

Off by default, so applying the patch changes nothing until an inbox opts
in. To enable it for a website inbox: Settings, Inboxes, pick the inbox,
Settings tab, "Widget features" section, then tick "Allow users to have
multiple conversations from the widget" and save.

With the setting off, the widget behaves as in the release: one
conversation, always the latest.

### Applying it

From a clean checkout of the release tag:

```sh
git apply --3way rainpath/patches/widget-multi-conversations.patch
```

### Rebasing it on a new release

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
     > rainpath/patches/widget-multi-conversations.patch
   ```

5. Check that it applies on a clean checkout of the release:
   `git apply --check rainpath/patches/widget-multi-conversations.patch`.

Checks run on v4.20.1, with Postgres (pgvector) and Redis running for rspec:

```sh
pnpm test
bundle exec rspec spec/controllers/api/v1/widget spec/builders/campaigns \
  spec/models/channel/web_widget_spec.rb spec/models/message_spec.rb \
  spec/controllers/api/v1/accounts/inboxes_controller_spec.rb
pnpm exec eslint app/javascript/widget
bundle exec rubocop app/controllers/api/v1/widget app/builders/campaigns
```

### When to drop it

Watch [chatwoot/chatwoot#16002](https://github.com/chatwoot/chatwoot/pull/16002).
Once it is merged and released, check that the release also covers the four
fixes listed above (or that the code they touch has changed), then delete
the patch and this section instead of rebasing it. If a fix is not
upstream yet, keep only that part as a smaller patch.
