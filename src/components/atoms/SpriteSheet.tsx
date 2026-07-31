/**
 * ATOM — the one and only copy of the feature sprite artwork.
 *
 * Rendered ONCE in the root layout. Every `<Sprite>` is a `<use href="#...">`
 * pointing here, because seven sprites inlined into 27 routes is dead weight
 * and a symbol sheet is not.
 *
 * PROVENANCE — read before adding to this file. This is **original art drawn to
 * OSRS's icon grammar**, not Jagex's sprites. Jagex owns the real ones; the Wiki
 * hosts them under fair dealing, not a redistribution licence. So we can neither
 * vendor the PNGs (hard rule #9 / ADR-0007) nor hotlink the Wiki CDN
 * (docs/api-terms.md). If literal sprites are ever wanted that is a licensing
 * conversation with Jagex, not a build step.
 *
 * The grammar, if you draw another: 32×32 item-sprite grid, integer coordinates
 * only, 1px `#1b1206` outline, flat fills with one highlight and one shade,
 * light from the top-left, no anti-aliasing, ≤6 colours. Fill classes are
 * defined in `globals.css` and are deliberately fixed hex, never tokens.
 *
 * `aria-hidden` and zero size: this element is a definition, not a picture. It
 * must stay in the accessibility tree's blind spot while remaining in the DOM.
 */

import { spriteId } from '@/lib/ui/sprites';

export function SpriteSheet() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <g id={spriteId('coins')}>
          <path className="o" d="M7,6 H13 L16,9 V15 L13,18 H7 L4,15 V9 Z" />
          <path className="g" d="M8,7 H12 L15,10 V14 L12,17 H8 L5,14 V10 Z" />
          <path className="gl" d="M15,11 V14 L12,17 H9 Z" />
          <path className="gh" d="M8,9 H10 V11 H8 Z" />
          <path className="o" d="M19,6 H25 L28,9 V15 L25,18 H19 L16,15 V9 Z" />
          <path className="g" d="M20,7 H24 L27,10 V14 L24,17 H20 L17,14 V10 Z" />
          <path className="gl" d="M27,11 V14 L24,17 H21 Z" />
          <path className="gh" d="M20,9 H22 V11 H20 Z" />
          <path className="o" d="M13,14 H19 L23,18 V24 L19,28 H13 L9,24 V18 Z" />
          <path className="g" d="M14,15 H18 L22,19 V23 L18,27 H14 L10,23 V19 Z" />
          <path className="gl" d="M22,20 V23 L18,27 H14 Z" />
          <path className="gh" d="M13,17 H16 V19 H13 Z" />
        </g>

        <g id={spriteId('scimitar')}>
          <path className="o" d="M22,2 H30 V10 L18,22 L12,25 L9,25 L11,20 Z" />
          <path className="st" d="M23,3 H29 V9 L17,21 L13,23 L12,22 L14,18 Z" />
          <path className="sth" d="M23,3 H29 V5 L18,16 L15,19 L14,17 Z" />
          <path className="stl" d="M29,7 V9 L17,21 L13,23 L12,22 Z" />
          <path className="o" d="M6,19 H16 L19,22 L12,29 L5,22 Z" />
          <path className="g" d="M7,20 H15 L17,22 L12,27 L7,22 Z" />
          <path className="gl" d="M17,22 L12,27 L9,24 H15 Z" />
          <path className="o" d="M7,24 L13,29 L9,32 H4 V28 Z" />
          <path className="wd" d="M8,25 L12,29 L9,31 H5 V28 Z" />
        </g>

        <g id={spriteId('anvil')}>
          <path className="o" d="M13,2 H25 V10 H13 Z" />
          <path className="ir" d="M14,3 H24 V9 H14 Z" />
          <path className="irh" d="M14,3 H24 V5 H14 Z" />
          <path className="irl" d="M22,3 H24 V9 H22 Z" />
          <path className="o" d="M5,14 L13,6 L16,9 L8,17 Z" />
          <path className="wd" d="M6,14 L13,7 L15,9 L8,16 Z" />
          <path className="o" d="M2,15 H30 V21 H21 V25 H27 V31 H5 V25 H11 V21 H2 Z" />
          <path className="ir" d="M3,16 H29 V20 H20 V26 H26 V30 H6 V26 H12 V20 H3 Z" />
          <path className="irh" d="M3,16 H29 V17 H3 Z" />
          <path
            className="irl"
            d="M3,19 H29 V20 H20 V26 H26 V30 H6 V29 H25 V26 H19 V19 Z"
          />
        </g>

        <g id={spriteId('clue')}>
          <path className="o" d="M3,6 H29 V26 H3 Z" />
          <path className="pg" d="M4,7 H28 V25 H4 Z" />
          <path className="pgh" d="M4,7 H28 V10 H4 Z" />
          <path className="pgl" d="M4,22 H28 V25 H4 Z" />
          <path className="o" d="M1,4 H8 V28 H1 Z" />
          <path className="pgl" d="M2,5 H7 V27 H2 Z" />
          <path className="pg" d="M2,5 H4 V27 H2 Z" />
          <path className="o" d="M24,4 H31 V28 H24 Z" />
          <path className="pgl" d="M25,5 H30 V27 H25 Z" />
          <path className="pg" d="M25,5 H27 V27 H25 Z" />
          <path className="o" d="M12,3 H20 V29 H12 Z" />
          <path className="rd" d="M13,4 H19 V28 H13 Z" />
          <path className="rdh" d="M13,4 H15 V28 H13 Z" />
        </g>

        <g id={spriteId('star')}>
          <path
            className="o"
            d="M16,1 L21,11 L31,12 L23,19 L26,30 L16,24 L6,30 L9,19 L1,12 L11,11 Z"
          />
          <path
            className="g"
            d="M16,5 L20,13 L27,14 L21,19 L23,26 L16,22 L9,26 L11,19 L5,14 L12,13 Z"
          />
          <path className="gh" d="M16,5 L19,11 L14,13 L12,13 Z" />
          <path className="gl" d="M16,22 L23,26 L21,19 L27,14 L20,13 Z" />
        </g>

        <g id={spriteId('shield')}>
          <path
            className="o"
            d="M16,1 L29,5 V15 L27,21 L22,27 L16,31 L10,27 L5,21 L3,15 V5 Z"
          />
          <path
            className="ir"
            d="M16,3 L27,7 V15 L25,20 L21,25 L16,28 L11,25 L7,20 L5,15 V7 Z"
          />
          <path className="irh" d="M16,3 L16,28 L11,25 L7,20 L5,15 V7 Z" />
          <path className="o" d="M16,7 L24,15 V21 L16,13 L8,21 V15 Z" />
          <path className="g" d="M16,9 L23,16 V19 L16,12 L9,19 V16 Z" />
        </g>

        <g id={spriteId('hourglass')}>
          <path className="o" d="M4,1 H28 V6 H4 Z" />
          <path className="wd" d="M5,2 H27 V5 H5 Z" />
          <path className="o" d="M4,26 H28 V31 H4 Z" />
          <path className="wd" d="M5,27 H27 V30 H5 Z" />
          <path className="o" d="M6,6 H26 L17,16 L26,26 H6 L15,16 Z" />
          <path className="gls" d="M7,7 H25 L16,16 Z" />
          <path className="gls" d="M16,16 L25,25 H7 Z" />
          <path className="g" d="M10,10 H22 L16,17 Z" />
          <path className="gh" d="M10,10 H22 V11 H10 Z" />
          <path className="g" d="M11,25 H21 L16,19 Z" />
          <path className="gl" d="M11,25 H21 L18,22 H14 Z" />
          <path className="g" d="M15,17 H17 V21 H15 Z" />
        </g>
      </defs>
    </svg>
  );
}
