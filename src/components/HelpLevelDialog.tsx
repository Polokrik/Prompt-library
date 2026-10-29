import { useEffect, useRef } from 'react';
import { QuickFrame } from './QuickFrame.tsx';
import { HELP_LEVELS, setHelpLevel, useHelpLevel, type HelpLevel } from '../utils/helpLevel.ts';

interface Props {
  /** Ouverture demandée par la personne (bouton « Niveau d'aide »). */
  requested: boolean;
  onClose: () => void;
}

/**
 * Fenêtre de choix du niveau d'aide. S'ouvre une seule fois à la première visite ; fermer sans choisir
 * (Échap) retient « Je me débrouille » pour ne pas la reposer à chaque page.
 */
export function HelpLevelDialog({ requested, onClose }: Props) {
  const level = useHelpLevel();
  const ref = useRef<HTMLDialogElement>(null);
  const firstVisit = level === null;
  const shouldOpen = firstVisit || requested;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg || typeof dlg.showModal !== 'function') return;
    if (shouldOpen && !dlg.open) dlg.showModal();
    if (!shouldOpen && dlg.open) dlg.close();
  }, [shouldOpen]);

  function choose(id: HelpLevel) {
    setHelpLevel(id);
    onClose();
  }
  function onCancel() {
    if (firstVisit) setHelpLevel('intermediate');
    onClose();
  }

  return (
    <dialog ref={ref} className="help-dialog" aria-labelledby="help-title" onCancel={onCancel} onClose={() => (requested ? onClose() : undefined)}>
      <h2 id="help-title">Quel niveau d’aide vous convient ?</h2>
      <p>Vous pourrez le changer à tout moment depuis le pied de page. Rien n’est envoyé : ce choix reste dans votre navigateur.</p>
      <ul className="help-dialog__choices">
        {HELP_LEVELS.map((l) => (
          <li key={l.id}>
            <button type="button" className="btn btn--outline help-dialog__choice" aria-pressed={level === l.id} onClick={() => choose(l.id)}>
              <span className="help-dialog__label">{l.label}</span>
              <span className="help-dialog__text">{l.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <QuickFrame />
      <p>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Plus tard
        </button>
      </p>
    </dialog>
  );
}
