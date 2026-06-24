import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  password: string;
  className?: string;
};

export function TemporaryPasswordField({ password, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={className}>
      <p className="text-xs text-green-700 mb-1.5">Временный пароль:</p>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all rounded bg-white/60 px-2 py-1.5 font-mono text-xs text-green-800">
          {password}
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-green-200 bg-white px-2 py-1.5 text-xs text-green-800 hover:bg-green-100/80"
          title="Копировать"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  );
}
