import { mount } from '@vue/test-utils';
import VueDOMPurifyHTML from 'vue-dompurify-html';
import { domPurifyConfig } from 'shared/helpers/HTMLSanitizer';
import AgentMessageBubble from '../AgentMessageBubble.vue';
import { handleMessageLinkClick } from '../../helpers/linkInterceptHelper';

// Renders a real agent bubble (the markdown goes through MessageFormatter and
// the widget's sanitizer) and clicks its link, with the delegated handler the
// widget installs on document.
describe('message link interception in an agent bubble', () => {
  let sendMessage;
  let listener;
  let wrapper;

  const mountBubble = message =>
    mount(AgentMessageBubble, {
      props: { message, messageType: 1, contentType: 'text' },
      attachTo: document.body,
      global: {
        plugins: [[VueDOMPurifyHTML, domPurifyConfig]],
        mocks: { $t: key => key },
      },
    });

  const clickLink = () => {
    const link = wrapper.find('.message-content a');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.element.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    sendMessage = vi.fn();
    listener = event =>
      handleMessageLinkClick(event, ['https://app.example.com'], sendMessage);
    document.addEventListener('click', listener);
  });

  afterEach(() => {
    document.removeEventListener('click', listener);
    wrapper?.unmount();
  });

  it('hands a link to a listed origin to the host page', () => {
    wrapper = mountBubble(
      'Ouvrez [Paramètres > Général](https://app.example.com/settings/general).'
    );

    expect(clickLink().defaultPrevented).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      event: 'onLinkClick',
      url: 'https://app.example.com/settings/general',
    });
  });

  it('keeps the new tab behaviour for any other link', () => {
    wrapper = mountBubble('Voir [la documentation](https://www.example.org/).');

    expect(clickLink().defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
