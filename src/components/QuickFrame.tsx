/** Cadre rapide : trois gestes pour utiliser une fiche. Affiché pour le niveau « Je découvre » et dans la fenêtre d'aide. */
export function QuickFrame({ hasFields = true, needsReference = false }: { hasFields?: boolean; needsReference?: boolean }) {
  return (
    <aside className="quick-frame" aria-label="Cadre rapide">
      <p className="quick-frame__title">En trois gestes</p>
      <ol>
        {hasFields ? <li>Remplissez les champs ci-dessous avec votre sujet (laissez vide ce qui ne vous concerne pas).</li> : <li>Lisez le prompt : vous pouvez le garder tel quel ou changer le sujet.</li>}
        <li>
          Copiez le prompt{needsReference ? ', puis joignez votre image' : ''} dans votre outil d’image (ChatGPT, Gemini, Midjourney…).
        </li>
        <li>Lancez, regardez, puis ajustez un détail à la fois (lumière, ambiance, cadrage) plutôt que tout réécrire.</li>
      </ol>
    </aside>
  );
}
