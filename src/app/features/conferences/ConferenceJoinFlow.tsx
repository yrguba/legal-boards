import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Copy, Check } from 'lucide-react';
import {
  applyIframeContainerStyles,
  createJitsiMeeting,
  loadJitsiExternalApi,
  type JitsiMeetApi,
} from './jitsiConfig';
import type { ConferencePublicInfo } from '../../types';

type Props = {
  info: ConferencePublicInfo;
  defaultDisplayName: string;
  requireName: boolean;
  conferenceId?: string;
  joinUrl?: string;
  /** Полноэкранный режим (гостевая страница без Layout). */
  standalone?: boolean;
  onShareChat?: () => void;
  onEnd?: () => Promise<void>;
  /** Выход из Jitsi (hangup). Организатор завершает конференцию на сервере. */
  onMeetingLeft?: () => void | Promise<void>;
  canEnd?: boolean;
};

export function ConferenceJoinFlow({
  info,
  defaultDisplayName,
  requireName,
  joinUrl,
  standalone = false,
  onShareChat,
  onEnd,
  onMeetingLeft,
  canEnd,
}: Props) {
  const [step, setStep] = useState<'intro' | 'room'>(requireName ? 'intro' : 'intro');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [jitsiError, setJitsiError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiMeetApi | null>(null);
  const meetingLeftHandledRef = useRef(false);

  useEffect(() => {
    if (!requireName && defaultDisplayName) {
      setDisplayName(defaultDisplayName);
    }
  }, [requireName, defaultDisplayName]);

  useEffect(() => {
    if (step !== 'room' || !displayName.trim() || !containerRef.current) return;

    const parent = containerRef.current;
    applyIframeContainerStyles(parent);
    setJitsiError(null);
    let cancelled = false;

    meetingLeftHandledRef.current = false;

    const handleMeetingLeft = () => {
      if (meetingLeftHandledRef.current) return;
      meetingLeftHandledRef.current = true;
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
      void (async () => {
        try {
          if (onMeetingLeft) {
            await onMeetingLeft();
          } else {
            setStep('intro');
          }
        } catch {
          setStep('intro');
        }
      })();
    };

    void loadJitsiExternalApi(info.jitsiDomain)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        parent.replaceChildren();
        const api = createJitsiMeeting(info.jitsiDomain, {
          roomName: info.roomName,
          subject: info.title,
          displayName: displayName.trim(),
          parentNode: parent,
          micOn,
          cameraOn,
          onMeetingLeft: handleMeetingLeft,
        });
        jitsiApiRef.current = api;
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setJitsiError(e instanceof Error ? e.message : 'Не удалось подключиться к Jitsi');
        }
      });

    return () => {
      cancelled = true;
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
      parent.replaceChildren();
    };
  }, [step, displayName, micOn, cameraOn, info.roomName, info.jitsiDomain, info.title, onMeetingLeft]);

  const handleCopy = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Скопируйте ссылку:', joinUrl);
    }
  };


  if (step === 'intro') {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-900 p-6 ${
          standalone ? 'min-h-0 flex-1' : 'min-h-[calc(100vh-4rem)]'
        }`}
      >
        <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-white mb-1">{info.title}</h1>
          <p className="text-sm text-slate-400 mb-6">Подготовка к входу в конференцию</p>

          {requireName ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Представьтесь</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ваше имя"
                maxLength={64}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-300">
              Вы входите как <span className="font-medium text-white">{displayName}</span>
            </p>
          )}

          <div className="mb-6 flex gap-3">
            <button
              type="button"
              onClick={() => setMicOn((v) => !v)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                micOn
                  ? 'border-green-600 bg-green-900/40 text-green-300'
                  : 'border-slate-600 bg-slate-900 text-slate-300'
              }`}
            >
              {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              {micOn ? 'Микрофон вкл.' : 'Микрофон выкл.'}
            </button>
            <button
              type="button"
              onClick={() => setCameraOn((v) => !v)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                cameraOn
                  ? 'border-green-600 bg-green-900/40 text-green-300'
                  : 'border-slate-600 bg-slate-900 text-slate-300'
              }`}
            >
              {cameraOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
              {cameraOn ? 'Камера вкл.' : 'Камера выкл.'}
            </button>
          </div>

          <button
            type="button"
            disabled={!displayName.trim()}
            onClick={() => setStep('room')}
            className="w-full rounded-lg bg-brand py-3 font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Войти в конференцию
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-col bg-slate-900 ${
        standalone ? 'h-full flex-1' : 'h-full min-h-[24rem] flex-1'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2">
        <span className="text-sm font-medium text-white truncate flex-1">{info.title}</span>
        {joinUrl ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Скопировано' : 'Копировать ссылку'}
          </button>
        ) : null}
        {onShareChat ? (
          <button
            type="button"
            onClick={onShareChat}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            Поделиться в чат
          </button>
        ) : null}
        {canEnd && onEnd ? (
          <button
            type="button"
            disabled={ending}
            onClick={async () => {
              setEnding(true);
              meetingLeftHandledRef.current = true;
              try {
                jitsiApiRef.current?.dispose();
                jitsiApiRef.current = null;
                await onEnd();
              } finally {
                setEnding(false);
              }
            }}
            className="rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50"
          >
            {ending ? '…' : 'Завершить'}
          </button>
        ) : null}
      </div>
      <div ref={containerRef} className="relative min-h-0 w-full flex-1">
        {jitsiError ? (
          <p className="p-4 text-sm text-red-300">{jitsiError}</p>
        ) : null}
      </div>
    </div>
  );
}
