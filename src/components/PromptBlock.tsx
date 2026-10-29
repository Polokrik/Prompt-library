import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { CopyButton } from './CopyButton.tsx';
import { FavoriteButton } from './FavoriteButton.tsx';
import { QuickFrame } from './QuickFrame.tsx';
import { findFields, fillPrompt, isShort, mentionsReference, splitPrompt, unfilledCount, type PromptField } from '../utils/guide.ts';
import { useHelpLevel } from '../utils/helpLevel.ts';
import { href } from '../utils/router.ts';
import type { PromptEntry } from '../types/library.ts';

/** Met en évidence les champs restés vides (crochets) dans le texte final. */
function highlight(text: string, fields: readonly PromptField[], values: Readonly<Record<string, string>>): ReactNode {
  const pending = fields.filter((f) => !(values[f.token] ?? '').trim() && f.defaultValue === undefined).map((f) => f.token);
  if (pending.length === 0) return text;
  const escaped = pending.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`));
  return parts.map((part, i) => (pending.includes(part) ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>));
}

export function PromptBlock({ entry }: { entry: PromptEntry }) {
  const level = useHelpLevel() ?? 'intermediate';
  const { base, detail } = useMemo(() => splitPrompt(entry.prompt), [entry.prompt]);
  const fields = useMemo(() => findFields(base), [base]);
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = fillPrompt(base, fields, values);
  const missing = unfilledCount(fields, values);
  const needsReference = entry.requiresReference === true || (entry.requiresReference !== false && mentionsReference(base));
  const showShortTip = fields.length === 0 && isShort(base);
  const composeHref = href('composeur', new URLSearchParams({ from: entry.id }));

  return (
    <section aria-labelledby="prompt-title" className="prompt-block">
      <h2 id="prompt-title">Prompt</h2>

      {level === 'beginner' ? <QuickFrame hasFields={fields.length > 0} needsReference={needsReference} /> : null}

      {needsReference ? (
        <p className="note note--reference">
          <strong>Image à fournir.</strong> Ce prompt {entry.requiresReference === true ? 'demande' : 'semble demander'} une image de votre part (un portrait, une photo, un
          objet…) : joignez-la à votre outil avant d’envoyer le texte.
        </p>
      ) : null}

      {fields.length > 0 ? (
        <details className="fields" open={level !== 'expert'}>
          <summary>
            À remplir avant de copier ({fields.length} champ{fields.length > 1 ? 's' : ''})
          </summary>
          {level === 'beginner' ? (
            <p className="field__hint">Chaque champ remplace une zone entre crochets du prompt. Laissez vide ce qui ne vous concerne pas.</p>
          ) : null}
          <div className="fields__grid">
            {fields.map((f, i) => (
              <div className="field" key={f.token}>
                <label htmlFor={`field-${i}`}>{f.label}</label>
                <input
                  id={`field-${i}`}
                  type="text"
                  value={values[f.token] ?? ''}
                  placeholder={f.defaultValue ?? ''}
                  onChange={(e) => setValues({ ...values, [f.token]: e.target.value })}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <pre className="prompt-text" lang={entry.language} tabIndex={0} aria-label="Texte du prompt">
        {highlight(filled, fields, values)}
      </pre>
      {missing > 0 ? (
        <p className="field__hint">
          {missing} zone{missing > 1 ? 's' : ''} encore entre crochets (surlignée{missing > 1 ? 's' : ''}) : l’IA les recevra telles quelles si vous ne les remplacez pas.
        </p>
      ) : null}

      <div className="prompt-block__actions">
        <CopyButton text={filled} accessibleName={`Copier le prompt : ${entry.title}`} />
        <FavoriteButton id={entry.id} title={entry.title} withLabel />
      </div>

      {detail ? (
        <details className="detail-more" open={level === 'expert'}>
          <summary>Précisions détaillées (optionnelles)</summary>
          <p className="field__hint">
            Consignes de style ajoutées à l’origine. Les IA récentes se débrouillent souvent très bien sans : essayez d’abord le prompt seul.
          </p>
          <pre className="prompt-text" lang="fr" tabIndex={0} aria-label="Précisions détaillées">
            {detail}
          </pre>
          <CopyButton text={`${filled}\n\n${detail}`} label="Copier avec les précisions" accessibleName={`Copier le prompt avec les précisions : ${entry.title}`} />
        </details>
      ) : null}

      {showShortTip ? (
        <p className="note">
          Prompt court : il laisse beaucoup de liberté à l’IA. Pour le préciser (lumière, ambiance, format…),{' '}
          <a href={composeHref}>étoffez-le dans le composeur →</a>
        </p>
      ) : null}
      <p className="compose-line">
        Envie de l’adapter ? <a href={composeHref}>Modifier ce prompt dans le composeur →</a>
      </p>
    </section>
  );
}
