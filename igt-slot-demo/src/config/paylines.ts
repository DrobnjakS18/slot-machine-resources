// Payline definitions as data. Each payline is an ordered list of {reel, row}
// cells, one per reel, walked left-to-right by the evaluator.
//
// Adding/removing a payline = edit this file, no code changes.

export type Cell = { reel: number; row: number };

export type Payline = {
  id: number;
  name: string;
  color: number;   // used for highlight overlay
  cells: Cell[];   // length === REEL_COUNT
};

// Standard 5x3 set: 3 horizontals + V + ^.
export const PAYLINES: Payline[] = [
  {
    id: 0, name: 'Top',    color: 0xef476f,
    cells: [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }, { reel: 3, row: 0 }, { reel: 4, row: 0 }],
  },
  {
    id: 1, name: 'Middle', color: 0xffd166,
    cells: [{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 1 }],
  },
  {
    id: 2, name: 'Bottom', color: 0x06d6a0,
    cells: [{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }, { reel: 3, row: 2 }, { reel: 4, row: 2 }],
  },
  {
    id: 3, name: 'V',      color: 0x118ab2,
    cells: [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }],
  },
  {
    id: 4, name: 'Caret',  color: 0x9b5de5,
    cells: [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }],
  },
];
