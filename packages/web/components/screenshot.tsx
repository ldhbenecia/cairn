// 제품 스크린샷을 글로우 프레임에. 캡처에 윈도우 크롬·배경이 포함돼 있어도 frame 이 자연스럽게 감싼다.
export function Screenshot({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="screenshot-frame">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
}
