/** Cadre rapide : trois gestes pour utiliser une fiche. Affiché pour le niveau « Je découvre » et dans la fenêtre d'aide. */
export function QuickFrame({ hasFields = true, needsReference = false }: { hasFields?: boolean; needsReference?: boolean }) {
  return (
    <aside className="quick-frame" aria-label="Cadre rapide">
      <p className="quick-frame__title">Prêt en 3 gestes</p>
      <ol>
        <li>{hasFields ? 'Remplissez les champs, ou gardez le prompt tel quel.' : 'Gardez le prompt tel quel, ou changez le sujet.'}</li>
        <li>{needsReference ? 'Copiez, joignez votre image, collez dans votre IA.' : 'Copiez, puis collez dans votre IA d’image.'}</li>
        <li>Ajustez un détail à la fois : lumière, ambiance, cadrage.</li>
      </ol>
    </aside>
  );
}
