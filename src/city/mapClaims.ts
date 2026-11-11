// Statements on the map that have a source but no number, from backlog R3.
export interface MapClaim {
  blockId: string;
  text: string;
  tag: 'published' | 'community' | 'this-machine' | 'modeled';
  source: string;
}

export const MAP_CLAIMS: MapClaim[] = [
  {
    blockId: 'wifi',
    text: 'off-chip',
    tag: 'community',
    source: 'Asahi firmware table and the M2 13" Broadcom driver commit. Local files use loopback (F5)',
  },
  {
    blockId: 'exit-built-in',
    text: 'driven by dcp',
    tag: 'modeled',
    source: "Inferred from Asahi's routing table",
  },
  {
    blockId: 'exit-lg',
    text: 'driven by dcpext',
    tag: 'modeled',
    source: "Inferred from Asahi's routing table",
  },
];
