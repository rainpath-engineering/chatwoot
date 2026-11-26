import { handleMessageLinkClick } from '../linkInterceptHelper';

const ORIGINS = ['https://app.example.com'];

const renderBubble = (html, bubbleClass = 'chat-bubble agent') => {
  document.body.innerHTML = `
    <div class="${bubbleClass}">
      <div class="message-content">${html}</div>
    </div>`;
  return document.body.querySelector('a');
};

// A click as the browser dispatches it, for a pointer or for Enter on a
// focused link (keyboard activation dispatches a click with detail 0).
const click = (element, init = {}) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  element.dispatchEvent(event);
  return event;
};

describe('#handleMessageLinkClick', () => {
  let sendMessage;
  let listener;
  let origins;

  beforeEach(() => {
    sendMessage = vi.fn();
    origins = ORIGINS;
    listener = event => handleMessageLinkClick(event, origins, sendMessage);
    document.addEventListener('click', listener);
  });

  afterEach(() => {
    document.removeEventListener('click', listener);
    document.body.innerHTML = '';
  });

  it('intercepts a link to a listed origin in an agent message', () => {
    const link = renderBubble(
      '<p>Open <a href="https://app.example.com/settings/general" target="_blank" rel="noreferrer noopener nofollow">the settings</a></p>'
    );

    const event = click(link);

    expect(event.defaultPrevented).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      event: 'onLinkClick',
      url: 'https://app.example.com/settings/general',
    });
  });

  it('intercepts a click on an element nested in the link', () => {
    renderBubble(
      '<a href="https://app.example.com/cases" target="_blank"><strong>Cases</strong></a>'
    );

    const event = click(document.body.querySelector('strong'));

    expect(event.defaultPrevented).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      event: 'onLinkClick',
      url: 'https://app.example.com/cases',
    });
  });

  it('intercepts keyboard activation of a focused link', () => {
    const link = renderBubble(
      '<a href="https://app.example.com/settings" target="_blank">Settings</a>'
    );
    link.focus();

    const event = click(link, { detail: 0 });

    expect(document.activeElement).toBe(link);
    expect(event.defaultPrevented).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('leaves a link to another origin alone', () => {
    const link = renderBubble(
      '<a href="https://www.example.org/docs" target="_blank">Docs</a>'
    );

    const event = click(link);

    expect(event.defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('leaves a lookalike or downgraded origin alone', () => {
    ['https://app.example.com.evil.test/', 'http://app.example.com/'].forEach(
      href => {
        const link = renderBubble(`<a href="${href}">Link</a>`);
        expect(click(link).defaultPrevented).toBe(false);
      }
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('leaves every link alone when no origin is configured', () => {
    origins = [];
    const link = renderBubble(
      '<a href="https://app.example.com/settings" target="_blank">Settings</a>'
    );

    expect(click(link).defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('leaves links outside an incoming message alone', () => {
    const userLink = renderBubble(
      '<a href="https://app.example.com/settings">Settings</a>',
      'chat-bubble user'
    );
    expect(click(userLink).defaultPrevented).toBe(false);

    document.body.innerHTML =
      '<footer><a href="https://app.example.com/">Powered by</a></footer>';
    expect(click(document.body.querySelector('a')).defaultPrevented).toBe(
      false
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ignores a click that was already handled', () => {
    const link = renderBubble(
      '<a href="https://app.example.com/settings">Settings</a>'
    );
    link.addEventListener('click', event => event.preventDefault());

    click(link);

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
