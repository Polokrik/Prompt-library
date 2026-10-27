import { useEffect, useState } from 'react';
import type { DuplicateCandidate, PromptEntry, ValidationIssue } from '../../types/library.ts';
import { CopyButton } from '../../components/CopyButton.tsx';

/**
 * Vue de revue : DÉVELOPPEMENT UNIQUEMENT (absente du build de production).
 * Lecture seule : elle indique quel fichier modifier et propose des extraits de mapping à copier.
 */

interface Loaded {
  all: PromptEntry[];
  issues: ValidationIssue[];
  duplicates: DuplicateCandidate[];
}

const FIX: Record<string, string> = {
  excel: 'imports/prompt-bible/Prompt Bible.xlsx (feuille CATALOGUE ou TEXTES)',
  mapping: 'imports/<source>/mapping.json',
  images: 'imports/images/<id>.jpg|png|webp puis npm run refresh',
  source: 'imports/external/source.json ou le lot brut',
  categories: 'Excel (colonnes « Famille proposée » / « Usages proposés ») ou mapping.categories',
};

function snippet(id: string, patch: Record<string, unknown>): string {
  return `"${id}": ${JSON.stringify(patch)}`;
}

function Section({ title, count, children, hint }: { title: string; count: number; children: React.ReactNode; hint: string }) {
  return (
    <details className="review__section" open={count > 0 && count < 40}>
      <summary>
        {title} <span className="review__count">{count}</span>
      </summary>
      <p className="review__hint">Où corriger : {hint}</p>
      {count === 0 ? <p>Rien à signaler.</p> : children}
    </details>
  );
}

function Row({ e, note, patch }: { e: PromptEntry; note?: string; patch?: Record<string, unknown> }) {
  const mappingFile = e.source.id === 'prompt-bible' ? 'imports/prompt-bible/mapping.json' : 'imports/external/mapping.json';
  return (
    <li className="review__row">
      <p>
        <strong>{e.title || '(sans titre)'}</strong> <code>{e.id}</code> — {e.status}
      </p>
      {e.reviewNotes?.length ? <p className="review__note">{e.reviewNotes.join(' · ')}</p> : null}
      {note ? <p className="review__note">{note}</p> : null}
      <p className="review__prompt">{e.prompt.slice(0, 220)}{e.prompt.length > 220 ? '…' : ''}</p>
      {patch ? (
        <p className="review__snippet">
          <code>{snippet(e.id, patch)}</code>{' '}
          <CopyButton compact text={snippet(e.id, patch)} accessibleName={`Copier l’extrait de mapping pour ${e.id}`} />
          <span> → à coller dans {mappingFile}</span>
        </p>
      ) : null}
    </li>
  );
}

export default function Review() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Imports dynamiques : les fichiers complets et les rapports ne sont jamais dans le bundle de production.
    Promise.all([
      import('../../data/prompts.json'),
      import('../../../reports/validation-report.json'),
      import('../../../reports/duplicates-report.json'),
    ])
      .then(([p, v, d]) =>
        setData({
          all: p.default as unknown as PromptEntry[],
          issues: (v.default as unknown as { issues: ValidationIssue[] }).issues,
          duplicates: (d.default as unknown as { candidates: DuplicateCandidate[] }).candidates,
        }),
      )
      .catch((e: Error) => setError(`Impossible de charger les données de revue : ${e.message}. Lancez npm run refresh.`));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Chargement de la revue…</p>;
  const { all, issues, duplicates } = data;
  const by = (s: string) => all.filter((e) => e.status === s);
  const noImage = all.filter((e) => e.status !== 'hidden' && !e.image);
  const noAlt = all.filter((e) => e.image && !e.image.alt.trim());
  const noCategory = all.filter((e) => e.status !== 'hidden' && e.categories.length === 0);
  const errors = issues.filter((i) => i.severity === 'error');

  return (
    <div className="review">
      <h1 className="page-title">Revue (développement)</h1>
      <p className="lede">
        Vue en lecture seule : rien n’est enregistré depuis le navigateur. Modifiez les fichiers indiqués, lancez{' '}
        <code>npm run refresh</code>, puis rechargez.
      </p>
      <p>
        {all.length} fiches au total — rapports : <code>reports/validation-report.json</code>, <code>reports/duplicates-report.json</code>
      </p>

      <Section title="Erreurs de validation" count={errors.length} hint="selon le champ « fixIn » de chaque erreur">
        <ul>
          {errors.map((i, k) => (
            <li key={k}>
              <code>{i.code}</code> {i.entryId ?? ''} — {i.message}
              {i.fixIn ? <em> → {FIX[i.fixIn]}</em> : null}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="À tester (visibles avec indicateur)" count={by('to-test').length} hint="vérifier le résultat avec un outil, puis ajouter l’image (imports/images/<id>.jpg) et passer le statut à published dans le mapping">
        <ul>{by('to-test').map((e) => <Row key={e.id} e={e} patch={{ status: 'published' }} />)}</ul>
      </Section>
      <Section title="À confirmer (non affichées publiquement)" count={by('to-confirm').length} hint="Excel (type, famille, usages, texte principal) ou mapping : status / categories / title">
        <ul>{by('to-confirm').map((e) => <Row key={e.id} e={e} patch={{ status: 'to-test' }} />)}</ul>
      </Section>
      <Section title="Masquées" count={by('hidden').length} hint="mapping : status (+ hiddenReason)">
        <ul>{by('hidden').map((e) => <Row key={e.id} e={e} note={e.hiddenReason} />)}</ul>
      </Section>
      <Section title="Images absentes" count={noImage.length} hint={FIX.images!}>
        <ul>{noImage.map((e) => <Row key={e.id} e={e} />)}</ul>
      </Section>
      <Section title="Textes alternatifs absents" count={noAlt.length} hint="mapping : image.alt">
        <ul>{noAlt.map((e) => <Row key={e.id} e={e} patch={{ image: { alt: '' } }} />)}</ul>
      </Section>
      <Section title="Catégories manquantes" count={noCategory.length} hint={FIX.categories!}>
        <ul>{noCategory.map((e) => <Row key={e.id} e={e} patch={{ categories: [] }} />)}</ul>
      </Section>
      <Section title="Doublons possibles" count={duplicates.length} hint="mapping : canonicalId (décision éditoriale) ; détails dans reports/duplicates-report.json">
        <ul>
          {duplicates.map((d, k) => (
            <li key={k} className="review__row">
              <p>
                <strong>{d.type}</strong> — {d.reason} {d.score ? `(${d.score})` : ''}
              </p>
              <p>
                <code>{d.ids.join(' · ')}</code>
              </p>
              <p className="review__note">{d.suggestion}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
