import { actions } from '../../appConfig';

// A script URL, the classic link injection payload.
// eslint-disable-next-line no-script-url
const SCRIPT_URL = 'javascript:alert(1)';

const commit = vi.fn();
describe('#actions', () => {
  describe('#setReferrerHost', () => {
    it('creates actions properly', () => {
      actions.setReferrerHost({ commit }, 'www.chatwoot.com');
      expect(commit.mock.calls).toEqual([
        ['SET_REFERRER_HOST', 'www.chatwoot.com'],
      ]);
    });
  });

  describe('#setBubbleVisibility', () => {
    it('creates actions properly', () => {
      actions.setBubbleVisibility({ commit }, false);
      expect(commit.mock.calls).toEqual([['SET_BUBBLE_VISIBILITY', false]]);
    });
  });

  describe('#setWidgetColor', () => {
    it('creates actions properly', () => {
      actions.setWidgetColor({ commit }, '#eaeaea');
      expect(commit.mock.calls).toEqual([['SET_WIDGET_COLOR', '#eaeaea']]);
    });
  });

  describe('#setColorScheme', () => {
    it('creates actions for dark mode properly', () => {
      actions.setColorScheme({ commit }, 'dark');
      expect(commit.mock.calls).toEqual([['SET_COLOR_SCHEME', 'dark']]);
    });
  });

  describe('#setRouteTransitionState', () => {
    it('creates actions properly', () => {
      actions.setRouteTransitionState({ commit }, false);
      expect(commit.mock.calls).toEqual([['SET_ROUTE_UPDATE_STATE', false]]);
    });
  });

  describe('#setAppConfig', () => {
    it('keeps only the valid link interception origins', () => {
      actions.setAppConfig(
        { commit },
        {
          linkInterceptOrigins: [
            'https://app.example.com',
            'http://localhost:5173',
            'http://app.example.com',
            SCRIPT_URL,
          ],
        }
      );
      expect(commit.mock.calls[0][1].linkInterceptOrigins).toEqual([
        'https://app.example.com',
        'http://localhost:5173',
      ]);
    });

    it('defaults to no link interception', () => {
      actions.setAppConfig({ commit }, {});
      expect(commit.mock.calls[0][1].linkInterceptOrigins).toEqual([]);
    });
  });
});
