// A script URL, the classic link injection payload.
// eslint-disable-next-line no-script-url
const SCRIPT_URL = 'javascript:alert(1)';

describe('chatwootSDK.run linkInterceptOrigins', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.$chatwoot;
  });

  afterEach(() => {
    delete window.$chatwoot;
    delete window.chatwootSettings;
    document.getElementById('cw-widget-holder')?.remove();
  });

  const runSDK = async () => {
    await import('../../entrypoints/sdk');
    window.chatwootSDK.run({
      baseUrl: 'https://chat.example.com',
      websiteToken: 'website-token',
    });
  };

  it('keeps only the valid origins of the setting', async () => {
    window.chatwootSettings = {
      linkInterceptOrigins: [
        'https://app.example.com',
        'http://localhost:5173',
        'http://app.example.com',
        SCRIPT_URL,
      ],
    };

    await runSDK();

    expect(window.$chatwoot.linkInterceptOrigins).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });

  it('defaults to no interception', async () => {
    window.chatwootSettings = {};

    await runSDK();

    expect(window.$chatwoot.linkInterceptOrigins).toEqual([]);
  });
});
