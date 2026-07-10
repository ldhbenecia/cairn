import { Github, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../settings-context';
import { FEEDBACK_EMAIL, REPO_URL } from './constants';

export function FeedbackTab() {
  const { t } = useSettings();
  const [feedback, setFeedback] = useState('');
  const [opened, setOpened] = useState(false);
  const openedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 언마운트(설정 다이얼로그 닫기) 시 타이머 정리 — 언마운트 후 setState 경고·누수 방지
  useEffect(
    () => () => {
      if (openedTimer.current) clearTimeout(openedTimer.current);
    },
    [],
  );

  function send() {
    const subject = `${t('prefs.feedback.subject')} (v${window.cairn.version})`;
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedback)}`;
    void window.cairn.openExternal(url);
    // 본문은 지우지 않는다 — 메일 클라이언트 미설정·이슈 로그인 리다이렉트로
    // 전송이 안 됐을 때 작성 내용이 유실되지 않도록
    markOpened();
  }

  function openIssue() {
    const body = `${feedback}\n\n---\ncairn v${window.cairn.version}`;
    const url = `${REPO_URL}/issues/new?body=${encodeURIComponent(body)}`;
    void window.cairn.openExternal(url);
    markOpened();
  }

  function markOpened() {
    setOpened(true);
    if (openedTimer.current) clearTimeout(openedTimer.current);
    openedTimer.current = setTimeout(() => setOpened(false), 4000);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-ink-tertiary">
        {opened ? t('prefs.feedback.opened') : t('prefs.feedback.desc')}
      </p>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={t('prefs.feedback.placeholder')}
        rows={6}
        className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-tertiary focus:border-accent/50 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={!feedback.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          <Send size={13} strokeWidth={2} />
          {t('prefs.feedback.send')}
        </button>
        <button
          type="button"
          onClick={openIssue}
          disabled={!feedback.trim()}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          <Github size={13} strokeWidth={2} />
          {t('prefs.feedback.send.issue')}
        </button>
      </div>
    </div>
  );
}
