export type SymbolId =
  | 'WD'  
  | 'A'   
  | 'K'   
  | 'Q'   
  | 'J'   
  | 'TEN' 
  | 'NINE'; 

export type SymbolMeta = {
  id: SymbolId;
  label: string;
  color: number; 
  textColor: number;
  frequency: [number, number, number, number, number];
  pays: [number, number, number];   // Pays for [3, 4, 5] of a kind on a payline, in credits per credit bet.
  isWild?: boolean;
};

export const SYMBOLS: Record<SymbolId, SymbolMeta> = {
  WD:   { id: 'WD',   label: 'WILD', color: 0xffd166, textColor: 0x1a1a1a, frequency: [1, 2, 2, 2, 1], pays: [0, 0, 0], isWild: true },
  A:    { id: 'A',    label: 'A',    color: 0xef476f, textColor: 0xffffff, frequency: [3, 3, 3, 3, 3], pays: [10, 50, 200] },
  K:    { id: 'K',    label: 'K',    color: 0xf78c6b, textColor: 0xffffff, frequency: [4, 4, 4, 4, 4], pays: [8, 30, 150] },
  Q:    { id: 'Q',    label: 'Q',    color: 0x06d6a0, textColor: 0x0b0f17, frequency: [5, 5, 5, 5, 5], pays: [5, 20, 100] },
  J:    { id: 'J',    label: 'J',    color: 0x118ab2, textColor: 0xffffff, frequency: [6, 6, 6, 6, 6], pays: [3, 12, 60] },
  TEN:  { id: 'TEN',  label: '10',   color: 0x9b5de5, textColor: 0xffffff, frequency: [7, 7, 7, 7, 7], pays: [2, 8, 40] },
  NINE: { id: 'NINE', label: '9',    color: 0x6c757d, textColor: 0xffffff, frequency: [8, 8, 8, 8, 8], pays: [2, 6, 30] },
};

export const SYMBOL_IDS: SymbolId[] = Object.keys(SYMBOLS) as SymbolId[];
