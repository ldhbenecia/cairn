import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'cairn — your daily dev work, as a Notion worklog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACCENT = '#5b61e6';

export default function OpengraphImage() {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 30, height: 14, borderRadius: 7, background: ACCENT }} />
          <div style={{ width: 50, height: 16, borderRadius: 8, background: '#8b90f0' }} />
          <div style={{ width: 72, height: 18, borderRadius: 9, background: '#cfd1f7' }} />
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>cairn</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            maxWidth: 940,
          }}
        >
          Your daily dev work, stacked into a worklog.
        </div>
        <div style={{ fontSize: 30, color: '#a9aab8', maxWidth: 880, lineHeight: 1.4 }}>
          GitHub PRs & commits → Claude summary → a dated Notion worklog. Automatic.
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
    { ...size },
  );
}
