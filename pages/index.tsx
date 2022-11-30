import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import generator from "../src/generator";

type Notes = {
  c: Array<number>;
  m: Array<number>;
};

type State = {
  sudoku: (number | Notes)[][];
  focusTile: null | [number, number];
  errors: boolean[][];
};

const SudokuContext = React.createContext<{
  sudoku: State["sudoku"];
  setSudoku: React.Dispatch<React.SetStateAction<State["sudoku"]>>;
  focusTile: State["focusTile"];
  setFocusTile: React.Dispatch<React.SetStateAction<State["focusTile"]>>;
  errors: State["errors"];
  setErrors: React.Dispatch<React.SetStateAction<State["errors"]>>;
  mutable: boolean[][];
}>(null as unknown as any);

const useSudoku = () => React.useContext(SudokuContext);

export const getServerSideProps = async () => {
  const { puzzle } = generator.getGame();
  const sudoku = Array.from({ length: 9 }, (_, i) => Array(9).fill(0));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const key = `${String.fromCharCode(65 + i)}${j + 1}`;
      sudoku[i][j] = Number(puzzle.get(key));
    }
  }
  return {
    props: {
      sudoku,
    },
  };
};

function checkError(sudoku: State["sudoku"]) {
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

function getCopy(sudoku: State["sudoku"]) {
  return sudoku.map((row) =>
    row.map((tile) =>
      typeof tile === "number" ? tile : { c: [...tile.c], m: [...tile.m] }
    )
  );
}

function pushOrdered(arr: number[], n: number) {
  let i = 0;
  while (i < arr.length && arr[i] < n) i++;
  arr.splice(i, 0, n);
}

function checkAnswered(value: any) {
  return typeof value === "number";
}

function removeNotesByValue(notes: Notes, val: number) {
  let idx = notes.c.indexOf(val);
  if (idx !== -1) notes.c.splice(idx, 1);
  idx = notes.m.indexOf(val);
  if (idx !== -1) notes.m.splice(idx, 1);
}

function updateNotes(sudoku: State["sudoku"], i: number, j: number) {
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

function getNoteClassName(i: number, total: number) {
  const isTop = total > 4 ? i < 3 : i < 2;
  const isMiddle = !isTop && total > 6 && i > 2 && i < total - 3;
  const isBottom = !isTop && !isMiddle;
  let isLeft = false;
  if (i === 0) isLeft = true;
  else if (total < 5) isLeft = i === 2;
  else if (i === 3) isLeft = true;
  else if (total > 6) isLeft = total - 3 === i;
  let isMid = false;
  if (total > 4) {
    if (i === 1) isMid = true;
    else if (total < 7) isMid = i === 4;
    else if (i === total - 2) isMid = true;
    else if (total === 9) isMid = i === 4;
  }
  const isRight = !isLeft && !isMid;
  return classNames("absolute text-xs text-gray-500", {
    "top-0": isTop,
    "top-1/2 -translate-y-1/2": isMiddle,
    "bottom-0": isBottom,
    "left-0": isLeft,
    "left-1/2 -translate-x-1/2": isMid,
    "right-0": isRight,
  });
}

function App({ sudoku: s }: { sudoku: number[][] }) {
  const [focusTile, setFocusTile] = useState<State["focusTile"]>(null);
  const [sudoku, setSudoku] = useState<State["sudoku"]>(
    s.map((row) => row.map((value) => (value ? value : { c: [], m: [] })))
  );
  const [errors, setErrors] = useState(Array(9).fill(Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState(0);
  const undoStack = useRef<State[]>([]);
  const mutable = useRef(
    sudoku.map((row) => row.map((v) => typeof v !== "number"))
  );

  useEffect(() => {
    function listener(event: KeyboardEvent) {
      // check ctrl+z
      if (event.ctrlKey && event.key === "z") {
        const last = undoStack.current.pop();
        if (last) {
          setSudoku(last.sudoku);
          setFocusTile(last.focusTile);
          setErrors(last.errors);
        }
      }
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    function listener(event: KeyboardEvent) {
      // check arrow keyboard
      if (focusTile) {
        const [i, j] = focusTile;
        if (event.key === "ArrowUp") {
          if (i > 0) setFocusTile([i - 1, j]);
        } else if (event.key === "ArrowDown") {
          if (i < 8) setFocusTile([i + 1, j]);
        } else if (event.key === "ArrowLeft") {
          if (j > 0) setFocusTile([i, j - 1]);
        } else if (event.key === "ArrowRight") {
          if (j < 8) setFocusTile([i, j + 1]);
        }
      }
      if (!focusTile || !mutable.current[focusTile[0]][focusTile[1]]) return;
      const isDelete = event.key === "Backspace" || event.key === "Delete";
      const input = Number(event.key);
      if (!isDelete && (input < 1 || input > 9 || isNaN(input))) return;
      const [row, col] = focusTile;
      let pushed = false;

      setSudoku((sudoku) => {
        const tile = sudoku[row][col];
        const answered = checkAnswered(tile);
        if (notesMode !== 0 && !isDelete && answered) return sudoku;
        if (
          isDelete &&
          typeof tile !== "number" &&
          tile.c.length === 0 &&
          tile.m.length === 0
        )
          return sudoku;
        if (!isDelete && tile === input) return sudoku;
        const copy = getCopy(sudoku);
        if (isDelete) {
          copy[row][col] = {
            c: [],
            m: [],
          };
        } else {
          if (notesMode !== 0) {
            const tile = copy[row][col] as Notes;
            const notes = notesMode === 1 ? tile.c : tile.m;
            const idx = notes.indexOf(input);
            if (idx !== -1) {
              notes.splice(idx, 1);
            } else {
              pushOrdered(notes, input);
            }
          } else {
            copy[row][col] = input;
            updateNotes(copy, row, col);
          }
        }
        const errors = checkError(copy);
        setErrors((oldErrors) => {
          if (!pushed) {
            undoStack.current.push({
              sudoku,
              focusTile,
              errors: oldErrors,
            });
            pushed = true;
          }
          return errors;
        });
        return copy;
      });
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [focusTile, notesMode]);

  return (
    <SudokuContext.Provider
      value={{
        focusTile,
        setFocusTile,
        sudoku,
        setSudoku,
        errors,
        setErrors,
        mutable: mutable.current,
      }}
    >
      <div className="w-full min-h-screen flex flex-col items-center justify-center max-w-screen-sm mx-auto border">
        <ul className="grid grid-cols-3 w-full max-w-md box-content border border-black">
          {Array(9)
            .fill(0)
            .map((_, i) => (
              <BigGrid key={i} id={i} />
            ))}
        </ul>
        <button
          onClick={() => setNotesMode((mode) => (mode + 1) % 3)}
          className={classNames()}
        >
          notes:{" "}
          {notesMode === 0 ? "off" : notesMode === 1 ? "corner" : "middle"}
        </button>
      </div>
    </SudokuContext.Provider>
  );
}

function BigGrid({ id }: { id: number }) {
  const { setFocusTile, sudoku, focusTile, errors, mutable } = useSudoku();
  return (
    <li className={classNames("border border-black")}>
      <ul className="grid grid-cols-3">
        {Array(9)
          .fill(0)
          .map((_, i) => {
            const row = Math.floor(id / 3) * 3 + Math.floor(i / 3);
            const col = (id % 3) * 3 + (i % 3);
            const tile = sudoku[row][col];
            const error = errors[row][col];
            const isMutable = mutable[row][col];
            return (
              <li
                key={i}
                className={classNames("aspect-square border-black border")}
              >
                <button
                  className={classNames(
                    "h-full w-full flex justify-center items-center focus:outline-none font-medium relative",
                    !isMutable && "text-blue-600",
                    error && "bg-red-200",
                    !error &&
                      focusTile &&
                      ((focusTile[0] === row && focusTile[1] === col) ||
                      (typeof tile === "number" &&
                        tile === sudoku[focusTile[0]][focusTile[1]])
                        ? "bg-blue-100"
                        : (focusTile[0] === row || focusTile[1] === col) &&
                          "bg-blue-50")
                  )}
                  onClick={() => setFocusTile([row, col])}
                >
                  {typeof tile === "number" ? (
                    tile
                  ) : (
                    <>
                      <div className="absolute inset-0">
                        {tile.c.map((n, i) => (
                          <span
                            key={i}
                            className={getNoteClassName(i, tile.c.length)}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-[1px] text-center text-xs text-gray-500">
                        {tile.m.map((n) => (
                          <span key={n}>{n}</span>
                        ))}
                      </div>
                    </>
                  )}
                </button>
              </li>
            );
          })}
      </ul>
    </li>
  );
}

export default App;