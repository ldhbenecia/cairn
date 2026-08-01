import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// 상태 전환 아이콘 크로스페이드 — 교체(visibility 토글) 대신 둘 다 렌더하고
// opacity·scale·blur 로 전환. 진입/이탈 모두 애니메이션되고 중간 상태에서 끊기지 않는다
export function CrossfadeIcon({
  active,
  from,
  to,
  size = 15,
}: {
  active: boolean;
  from: ReactNode;
  to: ReactNode;
  size?: number;
}) {
  const spring = { type: 'spring', duration: 0.3, bounce: 0 } as const;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        initial={false}
        animate={
          active
            ? { opacity: 0, scale: 0.25, filter: 'blur(4px)' }
            : { opacity: 1, scale: 1, filter: 'blur(0px)' }
        }
        transition={spring}
      >
        {from}
      </motion.span>
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        initial={false}
        animate={
          active
            ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
            : { opacity: 0, scale: 0.25, filter: 'blur(4px)' }
        }
        transition={spring}
      >
        {to}
      </motion.span>
    </span>
  );
}
