import { IFrameHelper } from '../IFrameHelper';

// A script URL, the classic link injection payload.
// eslint-disable-next-line no-script-url
const SCRIPT_URL = 'javascript:alert(1)';

describe('IFrameHelper link interception', () => {
  let listener;

  beforeEach(() => {
    listener = vi.fn();
    window.addEventListener('chatwoot:link-click', listener);
    window.$chatwoot = { linkInterceptOrigins: ['https://app.example.com'] };
  });

  afterEach(() => {
    window.removeEventListener('chatwoot:link-click', listener);
    window.onmessage = null;
    delete window.$chatwoot;
  });

  describe('#onLinkClick', () => {
    it('dispatches chatwoot:link-click with the URL on the host window', () => {
      IFrameHelper.events.onLinkClick({
        event: 'onLinkClick',
        url: 'https://app.example.com/settings/general',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const [event] = listener.mock.calls[0];
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.detail).toEqual({
        url: 'https://app.example.com/settings/general',
      });
    });

    it('ignores a URL outside the configured origins', () => {
      IFrameHelper.events.onLinkClick({ url: 'https://other.example.com/' });
      IFrameHelper.events.onLinkClick({ url: SCRIPT_URL });
      IFrameHelper.events.onLinkClick({ url: 42 });
      IFrameHelper.events.onLinkClick({});

      expect(listener).not.toHaveBeenCalled();
    });

    it('ignores every URL when no origin is configured', () => {
      window.$chatwoot = { linkInterceptOrigins: [] };
      IFrameHelper.events.onLinkClick({ url: 'https://app.example.com/' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('is reached through the widget post message channel', () => {
      IFrameHelper.initPostMessageCommunication();
      window.onmessage({
        data: `chatwoot-widget:${JSON.stringify({
          event: 'onLinkClick',
          url: 'https://app.example.com/cases',
        })}`,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toEqual({
        url: 'https://app.example.com/cases',
      });
    });
  });

  describe('#loaded', () => {
    it('forwards linkInterceptOrigins to the widget with the config', () => {
      const sendMessage = vi
        .spyOn(IFrameHelper, 'sendMessage')
        .mockImplementation(() => {});
      vi.spyOn(IFrameHelper, 'onLoad').mockImplementation(() => {});
      vi.spyOn(IFrameHelper, 'toggleCloseButton').mockImplementation(() => {});
      window.$chatwoot = {
        baseUrl: 'https://chat.example.com',
        linkInterceptOrigins: ['https://app.example.com'],
        resetTriggered: true,
      };

      IFrameHelper.events.loaded({
        config: { authToken: 'token', channelConfig: { widgetColor: '#000' } },
      });

      expect(sendMessage).toHaveBeenCalledWith(
        'config-set',
        expect.objectContaining({
          linkInterceptOrigins: ['https://app.example.com'],
        })
      );
    });
  });
});
