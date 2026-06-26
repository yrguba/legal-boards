import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  filterMentionCandidates,
  findActiveMentionQuery,
  type CommentMentionInsert,
  type MentionCandidate,
} from '../utils/commentMentions';
import { UserAvatar } from './UserAvatar';

type Props = {
  value: string;
  onChange: (value: string) => void;
  mentionInserts: CommentMentionInsert[];
  onMentionInsertsChange: (inserts: CommentMentionInsert[]) => void;
  users: MentionCandidate[];
  currentUserId?: string;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
};

export function CommentMentionTextarea({
  value,
  onChange,
  mentionInserts,
  onMentionInsertsChange,
  users,
  currentUserId,
  disabled,
  placeholder = 'Комментарий..',
  rows = 3,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(true);

  const candidates = useMemo(
    () =>
      mentionStart === null
        ? []
        : filterMentionCandidates(users, mentionQuery, currentUserId),
    [users, mentionQuery, mentionStart, currentUserId],
  );

  useEffect(() => {
    setHighlightIndex(0);
  }, [mentionQuery, mentionStart]);

  const closeMentionMenu = () => {
    setMentionStart(null);
    setMentionQuery('');
    setHighlightIndex(0);
  };

  const updateMenuPlacement = () => {
    const el = textareaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceAbove >= 160 || spaceAbove >= spaceBelow);
  };

  const syncMentionFromCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value;
    const cursor = el.selectionStart ?? text.length;
    const active = findActiveMentionQuery(text, cursor, mentionInserts);
    if (!active) {
      closeMentionMenu();
      return;
    }
    setMentionStart(active.start);
    setMentionQuery(active.query);
    updateMenuPlacement();
  };

  useLayoutEffect(() => {
    if (mentionStart === null) return;
    updateMenuPlacement();
    const onLayoutChange = () => updateMenuPlacement();
    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
    };
  }, [mentionStart, mentionQuery]);

  const insertMention = (user: MentionCandidate) => {
    const el = textareaRef.current;
    if (!el || mentionStart === null) return;

    const text = el.value;
    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    const visible = `@${user.name}`;
    const next = `${before}${visible} ${after}`;
    onChange(next);
    onMentionInsertsChange([...mentionInserts, { userId: user.id, name: user.name }]);
    closeMentionMenu();

    requestAnimationFrame(() => {
      const pos = before.length + visible.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionStart === null || candidates.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % candidates.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + candidates.length) % candidates.length);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(candidates[highlightIndex]!);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionMenu();
    }
  };

  const menuOpen = mentionStart !== null;

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(syncMentionFromCursor);
        }}
        onKeyDown={handleKeyDown}
        onClick={syncMentionFromCursor}
        onKeyUp={syncMentionFromCursor}
        className="min-h-[72px] w-full resize-y rounded border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />

      {menuOpen ? (
        <div
          className={`absolute left-0 right-0 z-[100] max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
          role="listbox"
          aria-label="Упоминание пользователя"
        >
          {candidates.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">Участники не найдены</div>
          ) : (
            candidates.map((user, index) => (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={index === highlightIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(user)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  index === highlightIndex
                    ? 'bg-brand-light text-brand'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <UserAvatar name={user.name} avatar={user.avatar} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{user.name}</span>
                {user.email ? (
                  <span className="max-w-[40%] truncate text-xs text-slate-500">{user.email}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
