import { useMemo, useState } from 'react';
import composerData from '../data/composer.json';
import { entriesById } from '../data/index.ts';
import type { ComposerData, ComposerOption } from '../types/composer.ts';
import { CopyButton } from '../components/CopyButton.tsx';
import { EMPTY_STATE, FORMATS, composePrompt, type ComposerState } from '../utils/composer.ts';
import { announce } from '../utils/announce.ts';
import { href, useRoute } from '../utils/router.ts';

const data = composerData as unknown as ComposerData;
const hint = (n: number) => data.blocks.find((b) => b.n === n)?.hint ?? '';

function optionLabel(o: ComposerOption): string {
  return o.hint ? `${o.label} — ${o.hint}` : o.label;
}

function Select({ id, label, value, onChange, options, empty = 'Au choix de l’image' }: { id: string; label: string; value: string; onChange: (v: string) => void; options: ComposerOption[]; empty?: string }) {
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {groups.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {options.filter((o) => o.group === g).map((o) => (
                <option key={o.id} value={o.id}>{optionLabel(o)}</option>
              ))}
            </optgroup>
          ) : (
            options.filter((o) => !o.group).map((o) => (
              <option key={o.id} value={o.id}>{optionLabel(o)}</option>
            ))
          ),
        )}
      </select>
    </div>
  );
}

function Text({ id, label, hintText, value, onChange, rows = 2 }: { id: string; label: string; hintText?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hintText ? `${id}-hint` : undefined} />
      {hintText ? <p className="field__hint" id={`${id}-hint`}>{hintText}</p> : null}
    </div>
  );
}

export default function Composer() {
  const route = useRoute();
  const from = route.params.get('from');
  const source = from ? entriesById.get(from) : undefined;
  const [state, setState] = useState<ComposerState>(() => ({ ...EMPTY_STATE, base: source?.prompt ?? '' }));
  const set = <K extends keyof ComposerState>(k: K, v: ComposerState[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggle = (k: 'moods' | 'exclusionIds', v: string) => set(k, state[k].includes(v) ? state[k].filter((x) => x !== v) : [...state[k], v]);

  const prompt = useMemo(() => composePrompt(state, data), [state]);
  const [templateId, setTemplateId] = useState('');

  function download() {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
    announce('Fichier prompt.txt téléchargé');
  }

  return (
    <div className="composer">
      <h1 className="page-title">Composeur</h1>
      <p className="lede">
        Un bon prompt se construit bloc par bloc. Remplissez ce que vous voulez : les champs vides ne produisent rien. Les propositions viennent de la Prompt Bible.
      </p>
      <p className="composer__skip"><a href="#resultat">Aller au prompt composé ↓</a></p>

      <div className="composer__layout">
        <form className="composer__form" onSubmit={(e) => e.preventDefault()} aria-label="Composition du prompt">
          <fieldset>
            <legend>Point de départ</legend>
            {source ? (
              <p className="field__hint">
                Basé sur la fiche <a href={href(`fiche/${encodeURIComponent(source.id)}`)}>{source.title}</a>. Modifiez le texte ci-dessous ou ajoutez des blocs.
              </p>
            ) : null}
            <Select
              id="template"
              label="Modèle de la Prompt Bible"
              value={templateId}
              empty="Aucun modèle"
              options={data.templates}
              onChange={(id) => {
                setTemplateId(id);
                const t = data.templates.find((o) => o.id === id);
                if (t) set('base', t.text);
              }}
            />
            <Text id="base" label="Prompt de départ (facultatif)" value={state.base} onChange={(v) => set('base', v)} rows={4} hintText="Si le texte contient une variable (<sujet> ou [Scene description]), le sujet ci-dessous la remplace." />
          </fieldset>

          <Text id="subject" label="01 · Le sujet" value={state.subject} onChange={(v) => set('subject', v)} hintText={hint(1)} />
          <Text id="action" label="02 · L’action" value={state.action} onChange={(v) => set('action', v)} hintText={hint(2)} />
          <Text id="setting" label="03 · Le décor" value={state.setting} onChange={(v) => set('setting', v)} hintText={hint(3)} />

          <fieldset>
            <legend>04 · Le récit et l’ambiance</legend>
            <p className="field__hint">{hint(4)}</p>
            <ul className="chips">
              {data.moods.map((m) => (
                <li key={m.label}>
                  <label className="chip">
                    <input type="checkbox" checked={state.moods.includes(m.label)} onChange={() => toggle('moods', m.label)} />
                    <span>{m.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="field">
              <label htmlFor="era">Époque</label>
              <select id="era" value={state.era} onChange={(e) => set('era', e.target.value)}>
                <option value="">Au choix de l’image</option>
                {data.eras.map((e) => (
                  <option key={e.label} value={e.label}>{e.label}</option>
                ))}
              </select>
            </div>
          </fieldset>

          <Select id="style" label="05 · Le style" value={state.styleId} onChange={(v) => set('styleId', v)} options={data.styles} />
          <Select id="effect" label="Effet de mouvement (facultatif)" value={state.effectId} onChange={(v) => set('effectId', v)} options={data.effects} empty="Aucun" />
          <Select id="lighting" label="06 · La lumière" value={state.lightingId} onChange={(v) => set('lightingId', v)} options={data.lighting} />
          <Text id="palette" label="Palette et couleurs" value={state.palette} onChange={(v) => set('palette', v)} rows={1} hintText="Ex. vert forêt, crème et orange." />
          <Text id="camera" label="07 · La caméra et le cadrage" value={state.camera} onChange={(v) => set('camera', v)} hintText={hint(7)} />
          <Text id="texture" label="08 · Les textures" value={state.texture} onChange={(v) => set('texture', v)} hintText={hint(8)} />
          <Text id="quality" label="09 · La qualité" value={state.quality} onChange={(v) => set('quality', v)} rows={1} hintText={hint(9)} />

          <div className="field">
            <label htmlFor="format">Le format</label>
            <select id="format" value={state.formatId} onChange={(e) => set('formatId', e.target.value)}>
              <option value="">Au choix de l’outil</option>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label} {f.ratio}</option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend>10 · Les exclusions</legend>
            <p className="field__hint">{hint(10)}</p>
            <ul className="checks">
              {data.exclusions.map((x) => (
                <li key={x.id}>
                  <label className="check">
                    <input type="checkbox" checked={state.exclusionIds.includes(x.id)} onChange={() => toggle('exclusionIds', x.id)} />
                    <span><strong>{x.label}</strong> <span className="check__text">{x.text}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <Text id="extra-exclusions" label="Autres exclusions" value={state.extraExclusions} onChange={(v) => set('extraExclusions', v)} rows={1} />
          </fieldset>

          <Text id="notes" label="Précisions" value={state.notes} onChange={(v) => set('notes', v)} />
          <p>
            <button type="button" className="btn btn--outline" onClick={() => { setState({ ...EMPTY_STATE }); setTemplateId(''); announce('Composeur remis à zéro'); }}>
              Tout effacer
            </button>
          </p>
        </form>

        <section className="composer__result" id="resultat" aria-labelledby="result-title">
          <h2 id="result-title">Votre prompt</h2>
          {prompt ? (
            <pre className="prompt-text" tabIndex={0} aria-label="Prompt composé">{prompt}</pre>
          ) : (
            <p className="composer__empty">Votre prompt se compose ici au fil de vos choix.</p>
          )}
          <p className="field__hint">{prompt ? `${prompt.length} caractères · ${prompt.split(/\s+/).length} mots` : ''}</p>
          <div className="prompt-block__actions">
            {prompt ? <CopyButton text={prompt} accessibleName="Copier le prompt composé" /> : null}
            {prompt ? <button type="button" className="btn btn--outline" onClick={download}>Télécharger .txt</button> : null}
          </div>
          <p className="field__hint">Les propositions étant écrites en français ou en anglais selon la Prompt Bible, relisez le résultat avant de l’utiliser dans votre outil d’image.</p>
        </section>
      </div>
    </div>
  );
}
