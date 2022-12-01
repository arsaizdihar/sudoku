import React from "react";
import { State } from "./type";

export const SudokuContext = React.createContext<{
  sudoku: State["sudoku"];
  setSudoku: React.Dispatch<React.SetStateAction<State["sudoku"]>>;
  focusTile: State["focusTile"];
  setFocusTile: React.Dispatch<React.SetStateAction<State["focusTile"]>>;
  errors: State["errors"];
  setErrors: React.Dispatch<React.SetStateAction<State["errors"]>>;
  mutable: boolean[][];
  focusRef: React.MutableRefObject<State["focusTile"]>;
  lockNum: number | null;
  setLockNum: React.Dispatch<React.SetStateAction<number | null>>;
  onNumberClick: (
    v: { num: number; isDelete?: boolean } | { isDelete: boolean; num?: number }
  ) => void;
  notesMode: number;
}>(null as unknown as any);

export const useSudoku = () => React.useContext(SudokuContext);
