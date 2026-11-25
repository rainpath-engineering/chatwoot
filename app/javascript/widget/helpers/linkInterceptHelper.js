import { getInterceptedUrl } from 'shared/helpers/linkInterceptHelper';
import { IFrameHelper } from './utils';

// Links rendered inside the content of an incoming message (agent or bot).
const MESSAGE_CONTENT_SELECTOR = '.chat-bubble.agent .message-content';

/**
 * Delegated click handler for message links. When the clicked link points to
 * one of `origins`, the default navigation (a new tab, as the message
 * formatter renders links with `target=_blank`) is cancelled and the URL is
 * handed to the host page through the SDK. Any other click is left alone.
 * Keyboard activation (Enter on a focused link) dispatches the same click.
 *
 * Returns true when the click was intercepted.
 */
export const handleMessageLinkClick = (
  event,
  origins,
  sendMessage = IFrameHelper.sendMessage
) => {
  if (!origins?.length || event.defaultPrevented) return false;

  const { target } = event;
  if (!target || typeof target.closest !== 'function') return false;

  const link = target.closest('a[href]');
  if (!link || !link.closest(MESSAGE_CONTENT_SELECTOR)) return false;

  const url = getInterceptedUrl(link.href, origins);
  if (!url) return false;

  event.preventDefault();
  sendMessage({ event: 'onLinkClick', url });
  return true;
};
