import { Notes, State } from "./type";

export function checkError(sudoku: State["sudoku"]) {
  const errors = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (typeof sudoku[i][j] !== "number") continue;
      for (let k = 0; k < 9; k++) {
        if (k === j) continue;
        if (sudoku[i][j] === sudoku[i][k]) {
          errors[i][j] = true;
          errors[i][k] = true;
        }
      }
      for (let k = 0; k < 9; k++) {
        if (k === i) continue;
        if (sudoku[i][j] === sudoku[k][j]) {
          errors[i][j] = true;
          errors[k][j] = true;
        }
      }
      const x = Math.floor(i / 3) * 3;
      const y = Math.floor(j / 3) * 3;
      for (let k = x; k < x + 3; k++) {
        for (let l = y; l < y + 3; l++) {
          if (k === i && l === j) continue;
          if (sudoku[i][j] === sudoku[k][l]) {
            errors[i][j] = true;
            errors[k][l] = true;
          }
        }
      }
    }
  }
  return errors;
}

export function getCopy(sudoku: State["sudoku"]) {
  return sudoku.map((row) =>
    row.map((tile) =>
      typeof tile === "number" ? tile : { c: [...tile.c], m: [...tile.m] }
    )
  );
}

export function pushOrdered(arr: number[], n: number) {
  let i = 0;
  while (i < arr.length && arr[i] < n) i++;
  arr.splice(i, 0, n);
}

export function checkAnswered(value: any) {
  return typeof value === "number";
}

export function removeNotesByValue(notes: Notes, val: number) {
  let idx = notes.c.indexOf(val);
  if (idx !== -1) notes.c.splice(idx, 1);
  idx = notes.m.indexOf(val);
  if (idx !== -1) notes.m.splice(idx, 1);
}

export function updateNotes(sudoku: State["sudoku"], i: number, j: number) {
  const val = sudoku[i][j] as number;
  const checked = new Set<string>();
  // check horizontal
  for (let k = 0; k < 9; k++) {
    checked.add(`${i}${k}`);
    let tile = sudoku[i][k];
    if (typeof tile === "number") continue;
    removeNotesByValue(tile, val);
  }

  // check vertical
  for (let k = 0; k < 9; k++) {
    const key = `${k}${j}`;
    if (checked.has(key)) continue;
    checked.add(key);
    let tile = sudoku[k][j];
    if (typeof tile === "number") continue;
    removeNotesByValue(tile, val);
  }

  // check square
  const x = Math.floor(i / 3) * 3;
  const y = Math.floor(j / 3) * 3;
  for (let k = x; k < x + 3; k++) {
    for (let l = y; l < y + 3; l++) {
      const key = `${k}${l}`;
      if (checked.has(key)) continue;
      let tile = sudoku[k][l];
      if (typeof tile === "number") continue;
      removeNotesByValue(tile, val);
    }
  }
}

export function searchFirstNum(sudoku: State["sudoku"], num: number) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (typeof sudoku[i][j] === "number" && sudoku[i][j] === num)
        return [i, j];
    }
  }
  return null;
}

export function autoNotate(sudoku: State["sudoku"]) {
  const copy = getCopy(sudoku);
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const tile = copy[i][j];
      if (typeof tile === "number") continue;
      tile.c = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      tile.m = [];
    }
  }
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const tile = copy[i][j];
      if (typeof tile !== "number") continue;
      updateNotes(copy, i, j);
    }
  }
  return copy;
}

export function checkWin(sudoku: State["sudoku"], errors: State["errors"]) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (typeof sudoku[i][j] !== "number" || errors[i][j]) return false;
    }
  }
  return true;
}

export function updateCounts(sudoku: State["sudoku"]) {
  const counts = new Array(9).fill(0);
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const tile = sudoku[i][j];
      if (typeof tile === "number") counts[tile - 1]++;
    }
  }
  return counts;
}
