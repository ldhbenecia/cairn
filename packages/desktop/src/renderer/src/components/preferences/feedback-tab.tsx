import { Github, Send } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../../settings-context';
import { FEEDBACK_EMAIL, REPO_URL } from './constants';

export function FeedbackTab() {
  const { t } = useSettings();
  const [feedback, setFeedback] = useState('');

  function send() {
    const subject = `${t('prefs.feedback.subject')} (v${window.cairn.version})`;
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedback)}`;
    void window.cairn.openExternal(url);
    setFeedback('');
  }

  function openIssue() {
    const body = `${feedback}\n\n---\ncairn v${window.cairn.version}`;
    const url = `${REPO_URL}/issues/new?body=${encodeURIComponent(body)}`;
    void window.cairn.openExternal(url);
    setFeedback('');
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-ink-tertiary">{t('prefs.feedback.desc')}</p>
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
