import { useCallback, useState } from 'react';

// 클립보드 복사 + 잠깐 '복사됨' 표시
export function useCopied(ms = 1500): [copied: boolean, copy: (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), ms);
      });
    },
    [ms],
  );
  return [copied, copy];
}
