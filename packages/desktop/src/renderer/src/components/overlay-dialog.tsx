import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// 자체 모달 오버레이 — 배경 클릭으로 닫고 패널 안 클릭은 막음, 패널 크기·레이아웃만 className 으로
export function OverlayDialog({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      onPointerDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 [-webkit-app-region:no-drag]"
    >
      <motion.div
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={`glass-panel max-w-[92vw] overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 ${className}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
