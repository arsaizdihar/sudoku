import classNames from "classnames";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Clock from "../src/Clock";
import generator from "../src/generator";

type Notes = {
  c: Array<number>;
  m: Array<number>;
};

const difficulties = [
  { name: "Easy", value: 0 },
  { name: "Medium", value: 1 },
  { name: "Hard", value: 2 },
  { name: "Expert", value: 3 },
];

type State = {
  sudoku: (number | Notes)[][];
  focusTile: null | [number, number];
  errors: boolean[][];
  counts: Array<number>;
};

const SudokuContext = React.createContext<{
  sudoku: State["sudoku"];
  setSudoku: React.Dispatch<React.SetStateAction<State["sudoku"]>>;
  focusTile: State["focusTile"];
  setFocusTile: React.Dispatch<React.SetStateAction<State["focusTile"]>>;
  errors: State["errors"];
  setErrors: React.Dispatch<React.SetStateAction<State["errors"]>>;
  mutable: boolean[][];
  focusRef: React.MutableRefObject<State["focusTile"]>;
}>(null as unknown as any);

const useSudoku = () => React.useContext(SudokuContext);

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const level = [28, 37, 45, 60];
  let dif = Number(ctx.query.dif);
  if (isNaN(dif) || dif < 0 || dif > 3) dif = 1;
  const { puzzle } = generator.getGame(level[dif]);
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

function checkWin(sudoku: State["sudoku"], errors: State["errors"]) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (typeof sudoku[i][j] !== "number" || errors[i][j]) return false;
    }
  }
  return true;
}

function App({ sudoku: s }: { sudoku: number[][] }) {
  const router = useRouter();
  let dif = Number(router.query.dif);
  if (isNaN(dif) || dif < 0 || dif > 3) dif = 1;
  const [focusTile, setFocusTile] = useState<State["focusTile"]>(null);
  const [sudoku, setSudoku] = useState<State["sudoku"]>(
    s.map((row) => row.map((value) => (value ? value : { c: [], m: [] })))
  );
  const [counts, setCounts] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [errors, setErrors] = useState(Array(9).fill(Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState(0);
  const undoStack = useRef<State[]>([]);
  const focusRef = useRef<State["focusTile"]>(null);
  const mutable = useRef(Array(9).fill(Array(9).fill(false)));
  const [startTime, setStartTime] = useState(new Date());

  const onNumberClick = useCallback(
    (
      v:
        | { num: number; isDelete?: boolean }
        | { isDelete: boolean; num?: number }
    ) => {
      const focusTile = focusRef.current;
      const isDelete = v.isDelete;
      const input = v.num as number;
      if (!focusTile || !mutable.current[focusTile[0]][focusTile[1]]) return;
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
          if (typeof tile === "number") {
            setCounts((counts) => {
              const copy = [...counts];
              copy[tile - 1]--;
              return copy;
            });
          }
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
            setCounts((counts) => {
              const copy = [...counts];
              copy[input - 1]++;
              return copy;
            });
            updateNotes(copy, row, col);
          }
        }
        const errors = checkError(copy);
        if (checkWin(copy, errors)) {
          alert("You win!");
        }
        setErrors((oldErrors) => {
          if (!pushed) {
            undoStack.current.push({
              sudoku,
              focusTile,
              errors: oldErrors,
              counts,
            });
            pushed = true;
          }
          return errors;
        });
        return copy;
      });
    },
    [notesMode, counts]
  );

  useEffect(() => {
    const sudoku = s.map((row) =>
      row.map((value) => (value ? value : { c: [], m: [] }))
    );
    setSudoku(sudoku);
    setFocusTile(null);
    focusRef.current = null;
    mutable.current = sudoku.map((row) =>
      row.map((v) => typeof v !== "number")
    );
    undoStack.current = [];
    const counts = Array(9).fill(0);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (s[i][j] !== 0) {
          counts[s[i][j] - 1]++;
        }
      }
    }
    setCounts(counts);
    setStartTime(new Date());
  }, [s]);

  useEffect(() => {
    function listener(event: KeyboardEvent) {
      // check ctrl+z
      if (event.ctrlKey && event.key === "z") {
        const last = undoStack.current.pop();
        if (last) {
          setSudoku(last.sudoku);
          setFocusTile(last.focusTile);
          setErrors(last.errors);
          setCounts(last.counts);
        }
      }
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    function listener(event: KeyboardEvent) {
      const focusTile = focusRef.current;
      if (event.key === "a") {
        setNotesMode(0);
        return;
      }
      if (event.key === "s") {
        setNotesMode(1);
        return;
      }
      if (event.key === "d") {
        setNotesMode(2);
        return;
      }

      // check arrow keyboard
      if (focusTile) {
        const [i, j] = focusTile;
        if (event.key === "ArrowUp") {
          if (i > 0) setFocusTile([i - 1, j]);
          return;
        } else if (event.key === "ArrowDown") {
          if (i < 8) setFocusTile([i + 1, j]);
          return;
        } else if (event.key === "ArrowLeft") {
          if (j > 0) setFocusTile([i, j - 1]);
          return;
        } else if (event.key === "ArrowRight") {
          if (j < 8) setFocusTile([i, j + 1]);
          return;
        }
      }
      const isDelete = event.key === "Backspace" || event.key === "Delete";
      const input = Number(event.key);
      if (!isDelete && (input < 1 || input > 9 || isNaN(input))) return;
      onNumberClick({ isDelete, num: input });
    }
    window.addEventListener("keyup", listener);
    return () => window.removeEventListener("keyup", listener);
  }, [onNumberClick]);

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
        focusRef,
      }}
    >
      <div className="w-full min-h-screen flex flex-col items-center justify-center max-w-screen-sm mx-auto border">
        <Clock start={startTime} />
        <ul className="grid grid-cols-3 w-full max-w-md box-content border border-black">
          {Array(9)
            .fill(0)
            .map((_, i) => (
              <BigGrid key={i} id={i} />
            ))}
        </ul>
        <div className="flex mt-1 gap-2 flex-wrap justify-center">
          <button
            className={classNames(
              notesMode === 0
                ? "bg-blue-400 text-blue-100"
                : "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => setNotesMode(0)}
          >
            Number
          </button>
          <button
            className={classNames(
              notesMode === 1
                ? "bg-blue-400 text-blue-100"
                : "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => setNotesMode(1)}
          >
            Corner Notes
          </button>
          <button
            className={classNames(
              notesMode === 2
                ? "bg-blue-400 text-blue-100"
                : "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => setNotesMode(2)}
          >
            Center Notes
          </button>
          <button
            className={classNames(
              "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => onNumberClick({ isDelete: true })}
          >
            Erase
          </button>
        </div>
        <div className="mt-2 grid grid-cols-9 gap-1 w-full max-w-sm">
          {counts.map((count, i) => (
            <button
              key={i}
              className={classNames(
                "pb-1 flex flex-col items-center rounded relative text-blue-800 font-medium text-lg focus:outline-none",
                count === 9 ? "bg-gray-200" : "bg-blue-200 hover:bg-blue-100"
              )}
              onClick={() => onNumberClick({ num: i + 1 })}
              disabled={count === 9}
            >
              <span>{i + 1}</span>
              <span className="text-xs text-gray-500">{count}</span>
            </button>
          ))}
        </div>
        <div className="mt-2">
          <select
            defaultValue={dif}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val !== dif) {
                router.push(`/?dif=${val}`);
              }
            }}
          >
            {difficulties.map((difficulty) => (
              <option value={difficulty.value} key={difficulty.value}>
                {difficulty.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </SudokuContext.Provider>
  );
}

function BigGrid({ id }: { id: number }) {
  const { setFocusTile, sudoku, focusTile, errors, mutable, focusRef } =
    useSudoku();
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
                  onClick={() => {
                    focusRef.current = [row, col];
                    setFocusTile([row, col]);
                  }}
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
