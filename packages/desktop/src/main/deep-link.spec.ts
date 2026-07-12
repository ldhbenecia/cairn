import { describe, expect, it } from 'vitest';
import { parseDeepLink } from './deep-link';

describe('parseDeepLink', () => {
  it('capture/append 호스트의 text 를 파싱한다', () => {
    expect(parseDeepLink('cairn://capture?text=%EC%98%A4%EB%8A%98%20%ED%9A%8C%EC%9D%98')).toEqual({
      action: 'capture',
      text: '오늘 회의',
    });
    expect(parseDeepLink('cairn://append?text=hi')).toEqual({ action: 'capture', text: 'hi' });
  });

  it('text 가 없거나 공백이면 null text (캡처 창 토글용)', () => {
    expect(parseDeepLink('cairn://capture')).toEqual({ action: 'capture', text: null });
    expect(parseDeepLink('cairn://capture?text=%20%20')).toEqual({ action: 'capture', text: null });
  });

  it('다른 프로토콜·미지 호스트·깨진 URL 은 무시한다', () => {
    expect(parseDeepLink('https://capture?text=x')).toBeNull();
    expect(parseDeepLink('cairn://settings?open=1')).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
  });

  it('상한 초과 텍스트를 자르지 않고 그대로 넘긴다 (거부는 memo-store 책임)', () => {
    const long = 'x'.repeat(400);
    expect(parseDeepLink(`cairn://capture?text=${long}`)?.text).toHaveLength(400);
  });
});
