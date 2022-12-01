export type Notes = {
  c: Array<number>;
  m: Array<number>;
};

export type State = {
  sudoku: (number | Notes)[][];
  focusTile: null | [number, number];
  errors: boolean[][];
};
