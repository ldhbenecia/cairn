'use client';

// hero 데모 영상 — 자동재생(음소거·루프·인라인). poster 로 첫 페인트는 스크린샷이 즉시 뜨고,
// 영상 로드되면 재생. 모션 최소화 설정이면 영상 대신 poster 만 보여준다.
export function HeroVideo({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  return (
    <div className="screenshot-frame block w-full overflow-hidden">
      <video
        className="block w-full"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    </div>
  );
}
