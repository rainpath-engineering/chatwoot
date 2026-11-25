import {
  getInterceptedUrl,
  sanitizeLinkInterceptOrigins,
} from '../linkInterceptHelper';

// A script URL, the classic link injection payload.
// eslint-disable-next-line no-script-url
const SCRIPT_URL = 'javascript:alert(1)';

describe('#sanitizeLinkInterceptOrigins', () => {
  it('returns an empty list when the setting is missing or not an array', () => {
    expect(sanitizeLinkInterceptOrigins(undefined)).toEqual([]);
    expect(sanitizeLinkInterceptOrigins(null)).toEqual([]);
    expect(sanitizeLinkInterceptOrigins('https://app.example.com')).toEqual([]);
    expect(
      sanitizeLinkInterceptOrigins({ 0: 'https://a.example.com' })
    ).toEqual([]);
  });

  it('keeps https origins and normalizes them', () => {
    expect(
      sanitizeLinkInterceptOrigins([
        'https://app.example.com',
        'https://App.Example.com/',
        'https://app.example.com:8443',
      ])
    ).toEqual(['https://app.example.com', 'https://app.example.com:8443']);
  });

  it('keeps http://localhost on any port for development', () => {
    expect(
      sanitizeLinkInterceptOrigins([
        'http://localhost',
        'http://localhost:5173',
      ])
    ).toEqual(['http://localhost', 'http://localhost:5173']);
  });

  it('drops insecure, non web and malformed origins', () => {
    expect(
      sanitizeLinkInterceptOrigins([
        'http://app.example.com',
        'http://localhost.example.com',
        'http://127.0.0.1:3000',
        SCRIPT_URL,
        'data:text/html,hello',
        'file:///etc/passwd',
        'ftp://app.example.com',
        'app.example.com',
        '*',
        '',
        42,
        null,
        {},
      ])
    ).toEqual([]);
  });

  it('drops values that are more than an origin', () => {
    expect(
      sanitizeLinkInterceptOrigins([
        'https://app.example.com/settings',
        'https://app.example.com/?a=1',
        'https://app.example.com/#top',
        'https://user:secret@app.example.com',
      ])
    ).toEqual([]);
  });
});

describe('#getInterceptedUrl', () => {
  const origins = ['https://app.example.com', 'http://localhost:5173'];

  it('returns the absolute URL of a link to a listed origin', () => {
    expect(
      getInterceptedUrl('https://app.example.com/settings/general', origins)
    ).toEqual('https://app.example.com/settings/general');
    expect(getInterceptedUrl('http://localhost:5173/cases', origins)).toEqual(
      'http://localhost:5173/cases'
    );
  });

  it('returns null for any other link', () => {
    expect(getInterceptedUrl('https://other.example.com/', origins)).toBeNull();
    expect(
      getInterceptedUrl('https://app.example.com.evil.test/', origins)
    ).toBeNull();
    expect(getInterceptedUrl('http://app.example.com/', origins)).toBeNull();
    expect(getInterceptedUrl('http://localhost:3000/', origins)).toBeNull();
    expect(getInterceptedUrl(SCRIPT_URL, origins)).toBeNull();
    expect(getInterceptedUrl('not a url', origins)).toBeNull();
    expect(getInterceptedUrl(undefined, origins)).toBeNull();
  });

  it('returns null when no origin is listed', () => {
    expect(getInterceptedUrl('https://app.example.com/', [])).toBeNull();
    expect(getInterceptedUrl('https://app.example.com/', undefined)).toBeNull();
  });
});
