// Pure: reads one table from `xcrun xctrace export --xpath ...` into plain rows.
// The export writes each repeated value once with an id, then points back to it with ref, at any depth.

export interface TraceCell {
  // The raw value, such as nanoseconds for a duration.
  text: string;
  // The value as Instruments prints it, such as "0.67 ms".
  fmt: string;
}

export type TraceRow = Record<string, TraceCell | null>;

const TAG = /<(\/?)([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>/g;

function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(attributes);
  return match ? (match[1] as string) : null;
}

function columnNames(xml: string): string[] {
  const schema = /<schema[\s\S]*?<\/schema>/.exec(xml)?.[0] ?? '';
  return [...schema.matchAll(/<mnemonic>([^<]*)<\/mnemonic>/g)].map((match) => match[1] as string);
}

interface OpenElement {
  id: string | null;
  fmt: string;
  textStart: number;
  cell: TraceCell | null;
}

export function parseTraceTable(xml: string): TraceRow[] {
  const columns = columnNames(xml);
  const byId = new Map<string, TraceCell>();
  const rows: TraceRow[] = [];
  const stack: OpenElement[] = [];
  let cells: (TraceCell | null)[] | null = null;

  const closeCell = (cell: TraceCell | null) => {
    // Depth 0 inside a row is a column. Anything deeper is only kept for later refs.
    if (cells && stack.length === 0) cells.push(cell);
  };

  TAG.lastIndex = xml.indexOf('</schema>');
  for (let tag = TAG.exec(xml); tag; tag = TAG.exec(xml)) {
    const [, closing, name, attributes = '', selfClosing] = tag;
    if (name === 'row') {
      if (!closing) {
        cells = [];
      } else if (cells) {
        const filled = cells;
        rows.push(Object.fromEntries(columns.map((column, index) => [column, filled[index] ?? null])));
        cells = null;
      }
      continue;
    }
    if (!cells) continue;

    if (closing) {
      const open = stack.pop();
      if (!open) continue;
      const text = xml.slice(open.textStart, tag.index);
      // An element with children has no value of its own, so its printed form stands in.
      const cell = open.cell ?? { text: text.includes('<') || text.trim() === '' ? open.fmt : text, fmt: open.fmt };
      if (open.id) byId.set(open.id, cell);
      closeCell(cell);
      continue;
    }

    const ref = attribute(attributes, 'ref');
    const cell = ref ? (byId.get(ref) ?? null) : null;
    if (selfClosing) {
      const id = attribute(attributes, 'id');
      const own = id ? { text: attribute(attributes, 'fmt') ?? '', fmt: attribute(attributes, 'fmt') ?? '' } : cell;
      if (id && own) byId.set(id, own);
      closeCell(name === 'sentinel' ? null : own);
      continue;
    }
    stack.push({ id: attribute(attributes, 'id'), fmt: attribute(attributes, 'fmt') ?? '', textStart: TAG.lastIndex, cell });
  }
  return rows;
}
