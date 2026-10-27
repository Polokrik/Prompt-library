import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard.ts';
import { announce } from '../utils/announce.ts';

interface Props {
  text: string;
  label?: string;
  /** Nom accessible complet (ex. « Copier le prompt : Robot barista »). */
  accessibleName: string;
  compact?: boolean;
}

export function CopyButton({ text, label = 'Copier le prompt', accessibleName, compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copyText(text);
    setState(ok ? 'done' : 'error');
    announce(ok ? 'Prompt copié dans le presse-papiers' : 'La copie a échoué : sélectionnez le texte manuellement');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  }

  return (
    <button type="button" className={`btn ${compact ? 'btn--small' : ''}`} onClick={onClick} aria-label={accessibleName}>
      {state === 'done' ? 'Copié ✓' : state === 'error' ? 'Échec de la copie' : compact ? 'Copier' : label}
    </button>
  );
}
