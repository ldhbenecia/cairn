import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

export const alt = 'cairn — your daily dev work, stacked into a worklog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#5b61e6';

// brand-mark.tsx 의 로고 path 와 동일 — OG 로고를 앱·사이트 BrandMark 로 통일
const BRAND_PATH =
  'M8810 10040 c-387 -93 -1832 -445 -3220 -785 -190 -47 -536 -131 -768 -187 l-424 -103 -280 -585 c-394 -824 -446 -935 -438 -938 4 -2 236 40 516 93 1469 278 2588 488 2662 500 23 4 42 4 42 1 0 -6 -141 -177 -789 -956 -413 -497 -1167 -1397 -1210 -1445 -20 -23 -92 -107 -160 -188 -111 -133 -146 -170 -125 -134 5 6 186 280 404 607 411 616 556 838 566 863 6 17 -21 11 -808 -159 l-458 -99 0 -818 0 -817 622 -668 c590 -634 790 -847 1252 -1341 l201 -215 3 990 3 989 239 280 c131 154 237 281 235 283 -5 5 -187 -23 -780 -118 -269 -43 -641 -102 -825 -130 -184 -28 -344 -54 -355 -57 -13 -3 -16 -2 -10 4 11 11 99 42 960 338 308 106 745 257 970 335 l410 142 625 705 c344 388 726 818 848 955 123 137 222 251 220 252 -1 1 -282 -64 -623 -145 -859 -205 -1773 -419 -1791 -419 -21 0 -22 -2 504 630 255 305 799 958 1210 1450 410 492 752 903 760 913 9 9 13 19 11 20 -2 2 -92 -17 -199 -43z';

export default async function OpengraphImage() {
  const serif = await readFile(join(process.cwd(), 'app/_fonts/Fraunces-600.ttf'));
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '88px 96px',
        background: '#08080c',
        backgroundImage:
          'radial-gradient(900px 520px at 18% -10%, rgba(91,97,230,0.34), transparent 60%), radial-gradient(700px 460px at 100% 120%, rgba(91,97,230,0.18), transparent 55%)',
        color: '#f4f4f7',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width={41} height={56} viewBox="355 233 558 766" fill={ACCENT}>
          <g transform="translate(0,1254) scale(0.1,-0.1)">
            <path d={BRAND_PATH} />
          </g>
        </svg>
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1, fontFamily: 'Fraunces' }}>
          cairn
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontFamily: 'Fraunces',
            fontSize: 82,
            fontWeight: 600,
            lineHeight: 1.02,
            letterSpacing: -1.5,
            maxWidth: 960,
          }}
        >
          Your daily dev work, stacked into a worklog.
        </div>
        <div style={{ fontSize: 30, color: '#a9aab8', maxWidth: 880, lineHeight: 1.4 }}>
          GitHub activity → an AI-written worklog in your journal. Automatic.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 26,
          color: '#7e8092',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 5, background: ACCENT }} />
        github.com/ldhbenecia/cairn
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Fraunces', data: serif, style: 'normal', weight: 600 }] },
  );
}
