// Built-in sticker pack: simple cartoon faces and gestures drawn as inline
// SVG, so there are no image files to bundle. A sticker message stores only
// the id below (Message.body for kind="sticker"); the backend just checks the
// id's shape, so adding a sticker here needs no backend change - ids must be
// lowercase letters, digits and underscores, max 40 characters.

const INK = "#24213F";
const YELLOW = "#FFD54F";
const STROKE = `stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${inner}</svg>`;
}

function face(fill: string, features: string): string {
  return svg(`<circle cx="64" cy="64" r="56" fill="${fill}" ${STROKE}/>${features}`);
}

const dot = (cx: number, cy: number, r = 6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>`;
const line = (d: string) => `<path d="${d}" fill="none" ${STROKE}/>`;
const eyes = dot(44, 54) + dot(84, 54);
const smile = line("M38 78 Q64 104 90 78");

const hand = (rect: string) => `<g fill="${YELLOW}" ${STROKE}>${rect}</g>`;

export type StickerDef = { id: string; label: string; xml: string };

export const STICKERS: StickerDef[] = [
  { id: "smile", label: "Smile", xml: face(YELLOW, eyes + smile) },
  {
    id: "laugh",
    label: "Laughing",
    xml: face(
      YELLOW,
      line("M34 56 Q44 44 54 56") +
        line("M74 56 Q84 44 94 56") +
        `<path d="M34 76 Q64 112 94 76 Z" fill="#fff" ${STROKE}/>` +
        `<path d="M24 62 q-6 10 0 14 q6 -4 0 -14 Z" fill="#6EC6FF"/><path d="M104 62 q6 10 0 14 q-6 -4 0 -14 Z" fill="#6EC6FF"/>`
    ),
  },
  {
    id: "love",
    label: "Love",
    xml: face(
      YELLOW,
      `<path d="M44 66 C26 52 30 40 40 40 C44 40 44 44 44 46 C44 44 44 40 48 40 C58 40 62 52 44 66 Z" fill="#FF5C7A"/>` +
        `<path d="M84 66 C66 52 70 40 80 40 C84 40 84 44 84 46 C84 44 84 40 88 40 C98 40 102 52 84 66 Z" fill="#FF5C7A"/>` +
        smile
    ),
  },
  {
    id: "cool",
    label: "Cool",
    xml: face(
      YELLOW,
      `<rect x="26" y="44" width="34" height="22" rx="8" fill="${INK}"/><rect x="68" y="44" width="34" height="22" rx="8" fill="${INK}"/>` +
        line("M60 52 H68") +
        line("M40 82 Q64 98 88 82")
    ),
  },
  { id: "wink", label: "Wink", xml: face(YELLOW, dot(44, 54) + line("M74 56 Q84 46 94 56") + smile) },
  {
    id: "sad",
    label: "Sad",
    xml: face(YELLOW, eyes + line("M40 94 Q64 72 88 94") + line("M30 38 L52 44") + line("M98 38 L76 44")),
  },
  {
    id: "cry",
    label: "Crying",
    xml: face(
      YELLOW,
      eyes +
        line("M40 94 Q64 74 88 94") +
        `<path d="M44 64 q-7 14 0 20 q7 -6 0 -20 Z" fill="#6EC6FF"/><path d="M84 64 q-7 14 0 20 q7 -6 0 -20 Z" fill="#6EC6FF"/>`
    ),
  },
  {
    id: "angry",
    label: "Angry",
    xml: face("#FF8A72", dot(44, 58) + dot(84, 58) + line("M30 40 L54 50") + line("M98 40 L74 50") + line("M42 92 Q64 76 86 92")),
  },
  {
    id: "surprised",
    label: "Surprised",
    xml: face(
      YELLOW,
      `<circle cx="44" cy="52" r="9" fill="#fff" ${STROKE}/><circle cx="84" cy="52" r="9" fill="#fff" ${STROKE}/>` +
        dot(44, 52, 4) +
        dot(84, 52, 4) +
        `<ellipse cx="64" cy="90" rx="10" ry="13" fill="${INK}"/>`
    ),
  },
  {
    id: "sleepy",
    label: "Sleepy",
    xml: face(
      YELLOW,
      line("M32 56 Q44 64 56 56") +
        line("M72 56 Q84 64 96 56") +
        `<ellipse cx="64" cy="90" rx="9" ry="6" fill="${INK}"/>` +
        `<text x="92" y="30" font-size="22" font-weight="700" fill="${INK}" font-family="sans-serif">z</text>` +
        `<text x="104" y="18" font-size="16" font-weight="700" fill="${INK}" font-family="sans-serif">z</text>`
    ),
  },
  {
    id: "thinking",
    label: "Thinking",
    xml: face(
      YELLOW,
      dot(44, 56) + dot(84, 56) + line("M32 40 L56 38") + line("M76 46 L98 40") + line("M46 90 H78 L84 86")
    ),
  },
  {
    id: "party",
    label: "Party",
    xml: svg(
      `<circle cx="64" cy="72" r="48" fill="${YELLOW}" ${STROKE}/>` +
        `<path d="M64 6 L92 46 H36 Z" fill="#7565F5" ${STROKE}/><circle cx="64" cy="8" r="7" fill="#FF824D" ${STROKE}/>` +
        dot(46, 66) +
        dot(82, 66) +
        line("M40 88 Q64 110 88 88") +
        `<circle cx="14" cy="40" r="4" fill="#FF5C7A"/><circle cx="114" cy="34" r="4" fill="#6EC6FF"/><circle cx="108" cy="100" r="4" fill="#FF824D"/><circle cx="18" cy="104" r="4" fill="#7565F5"/>`
    ),
  },
  {
    id: "thumbs_up",
    label: "Thumbs up",
    xml: svg(
      hand(`<rect x="40" y="18" width="24" height="52" rx="12"/>`) +
        hand(`<rect x="30" y="56" width="68" height="56" rx="16"/>`) +
        line("M46 78 H84 M46 94 H84")
    ),
  },
  {
    id: "peace",
    label: "Peace",
    xml: svg(
      hand(`<rect x="38" y="10" width="16" height="60" rx="8" transform="rotate(-10 46 70)"/>`) +
        hand(`<rect x="66" y="10" width="16" height="60" rx="8" transform="rotate(10 74 70)"/>`) +
        hand(`<rect x="30" y="58" width="68" height="54" rx="16"/>`) +
        line("M46 84 H84")
    ),
  },
  {
    id: "wave",
    label: "Wave",
    xml: svg(
      hand(`<rect x="24" y="74" width="14" height="32" rx="7" transform="rotate(-35 31 90)"/>`) +
        hand(`<rect x="38" y="14" width="14" height="60" rx="7"/>`) +
        hand(`<rect x="54" y="8" width="14" height="66" rx="7"/>`) +
        hand(`<rect x="70" y="14" width="14" height="60" rx="7"/>`) +
        hand(`<rect x="86" y="26" width="14" height="50" rx="7"/>`) +
        hand(`<rect x="36" y="58" width="66" height="54" rx="20"/>`)
    ),
  },
  {
    id: "heart",
    label: "Heart",
    xml: svg(
      `<path d="M64 112 C16 78 10 40 36 28 C52 21 62 30 64 40 C66 30 76 21 92 28 C118 40 112 78 64 112 Z" fill="#FF5C7A" ${STROKE}/>` +
        `<path d="M36 44 Q40 36 48 36" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`
    ),
  },
  {
    id: "star",
    label: "Star",
    xml: svg(
      `<polygon points="64,10 79,46 118,50 88,76 97,114 64,94 31,114 40,76 10,50 49,46" fill="#FFC83D" ${STROKE}/>`
    ),
  },
  {
    id: "fire",
    label: "Fire",
    xml: svg(
      `<path d="M64 8 C70 32 100 46 100 82 C100 106 84 120 64 120 C44 120 28 106 28 82 C28 62 42 54 46 38 C54 46 58 54 58 62 C66 46 62 28 64 8 Z" fill="#FF824D" ${STROKE}/>` +
        `<path d="M64 66 C70 82 84 88 84 100 C84 112 74 118 64 118 C54 118 44 112 44 100 C44 88 58 82 64 66 Z" fill="${YELLOW}"/>`
    ),
  },
];

const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

export function getSticker(id: string): StickerDef | undefined {
  return BY_ID.get(id);
}
