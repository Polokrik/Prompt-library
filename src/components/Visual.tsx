import type { PromptEntry } from '../types/library.ts';
import { assetUrl } from '../utils/assets.ts';
import { excerpt, tintOf } from '../utils/labels.ts';

interface Props {
  entry: PromptEntry;
  size: 'thumb' | 'large';
  eager?: boolean;
}

const RATIO = { landscape: '4 / 3', portrait: '3 / 4', square: '1 / 1' } as const;

/**
 * Image de la fiche, ou vignette typographique quand aucune image n'existe.
 * La vignette est décorative (le texte est déjà dans la fiche) et n'invente aucune image.
 */
export function Visual({ entry, size, eager = false }: Props) {
  if (entry.image) {
    const { thumbnail, large, alt, width, height } = entry.image;
    return (
      <img
        className="visual visual--image"
        src={assetUrl(size === 'thumb' ? thumbnail : large)}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        {...(width && height ? { width: size === 'thumb' ? 480 : width, height: size === 'thumb' ? Math.round((480 * height) / width) : height } : {})}
      />
    );
  }
  const ratio = RATIO[entry.orientation ?? 'landscape'];
  return (
    <div
      className={`visual visual--tile visual--${size}`}
      data-tint={tintOf(entry.categories[0] ?? entry.id)}
      style={{ aspectRatio: size === 'thumb' ? ratio : undefined }}
      aria-hidden="true"
    >
      <span className="visual__kind">{entry.categories[0] ?? ''}</span>
      <span className="visual__text">{excerpt(entry.prompt, size === 'thumb' ? 120 : 260)}</span>
    </div>
  );
}
