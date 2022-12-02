import classNames from "classnames";
import { GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import Clock from "../src/Clock";
import { SudokuContext, useSudoku } from "../src/Context";
import generator from "../src/generator";
import {
  checkUnique,
  makepuzzle,
  ratepuzzle,
  solveboard,
  solvepuzzle,
} from "../src/solver";
import { Notes, State } from "../src/type";
import {
  autoNotate,
  checkAnswered,
  checkError,
  checkWin,
  getCopy,
  pushOrdered,
  searchFirstNum,
  updateCounts,
  updateNotes,
} from "../src/utils";
makepuzzle;
solvepuzzle;
ratepuzzle;
solveboard;

const difficulties = [
  { name: "Easy", value: 0 },
  { name: "Medium", value: 1 },
  { name: "Hard", value: 2 },
  { name: "Expert", value: 3 },
];

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const level = [28, 37, 45, 58];
  let dif = Number(ctx.query.dif);
  if (isNaN(dif) || dif < 0 || dif > 3) dif = 1;
  let missing = level[dif];
  let sd = [];
  let count = 0;
  const sudoku = [];
  let solution = [];
  do {
    count++;
    if (count > 10) missing--;
    const { puzzle } = generator.getGame(missing);
    sd = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const key = `${String.fromCharCode(65 + i)}${j + 1}`;
        let val: number | null = Number(puzzle.get(key)) - 1;
        if (val === -1) {
          val = null;
        }
        sd.push(val);
      }
    }
    solution = checkUnique(sd);
    if (solution) break;
  } while (true);

  for (let i = 0; i < 9; i++) {
    const row = [];
    for (let j = 0; j < 9; j++) {
      const val = sd[i * 9 + j];
      row.push(val !== null ? val + 1 : null);
    }
    sudoku.push(row);
  }

  const sol = [];

  for (let i = 0; i < 9; i++) {
    const row = [];
    for (let j = 0; j < 9; j++) {
      const val = solution[i * 9 + j];
      row.push(val !== null ? val + 1 : null);
    }
    sol.push(row);
  }

  return {
    props: {
      sudoku,
      solution: sol,
    },
  };
};

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
    "top-[1px]": isTop,
    "top-1/2 -translate-y-1/2": isMiddle,
    "bottom-[1px]": isBottom,
    "left-[1px]": isLeft,
    "left-1/2 -translate-x-1/2": isMid,
    "right-[1px]": isRight,
  });
}

function App({
  sudoku: s,
  solution,
}: {
  sudoku: number[][];
  solution: number[][];
}) {
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
  const [finished, setFinished] = useState(false);
  const [lockNum, setLockNum] = useState<number | null>(null);

  const onNumberClick = useCallback(
    (v: { num?: number; isDelete?: boolean; pos?: [number, number] }) => {
      const focusTile = focusRef.current;
      const pos = v.pos || focusTile;
      const isDelete = v.isDelete;
      const input = v.num as number;
      if (!pos || !mutable.current[pos[0]][pos[1]]) return;
      const [row, col] = pos;
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
            setCounts(updateCounts(copy));
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
            if (counts[input - 1] === 9) return sudoku;
            copy[row][col] = input;
            setCounts(updateCounts(copy));
            updateNotes(copy, row, col);
          }
        }
        const errors = checkError(copy);
        if (checkWin(copy, errors)) {
          setFinished(true);
          alert("You win!");
        }
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
    },
    [notesMode, counts]
  );

  useEffect(() => {
    if (!lockNum) return;
    if (counts[lockNum - 1] === 9) {
      setLockNum(0);
      return;
    }
  }, [counts, lockNum]);

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
    setErrors(Array(9).fill(Array(9).fill(false)));
  }, [s]);

  useEffect(() => {
    if (finished) return;
    function listener(event: KeyboardEvent) {
      // check ctrl+z
      if (event.ctrlKey && event.key === "z") {
        const last = undoStack.current.pop();
        if (last) {
          setSudoku(last.sudoku);
          setFocusTile(last.focusTile);
          focusRef.current = last.focusTile;
          setErrors(last.errors);
          setCounts(updateCounts(last.sudoku));
        }
      }
    }
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [finished]);

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
      if (!isDelete && lockNum) {
        if (counts[input - 1] === 9) return;
        setLockNum(input);
        const pos: any = searchFirstNum(sudoku, input);
        if (pos) {
          setFocusTile(pos);
          focusRef.current = pos;
        }
        return;
      }
      onNumberClick({ isDelete, num: input });
    }
    window.addEventListener("keyup", listener);
    return () => window.removeEventListener("keyup", listener);
  }, [onNumberClick, sudoku]);

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
        lockNum,
        setLockNum,
        onNumberClick,
        notesMode,
      }}
    >
      <div className="w-full min-h-screen flex flex-col items-center justify-center max-w-screen-sm mx-auto border">
        <Clock start={startTime} finished={finished} />
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
            onClick={() => {
              if (finished) return;
              onNumberClick({ isDelete: true });
            }}
          >
            Erase
          </button>
          <button
            className={classNames(
              "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => {
              if (finished) return;
              const last = undoStack.current.pop();
              if (last) {
                setSudoku(last.sudoku);
                setFocusTile(last.focusTile);
                setErrors(last.errors);
                setCounts(updateCounts(last.sudoku));
              }
            }}
          >
            Undo
          </button>
          <button
            className={classNames(
              "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => {
              setSudoku((sudoku) => autoNotate(sudoku));
            }}
          >
            Auto Notes
          </button>
          <button
            className={classNames(
              "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => {
              const errors: boolean[][] = Array.from({ length: 9 }, () =>
                Array(9).fill(false)
              );
              for (let i = 0; i < 9; i++) {
                for (let j = 0; j < 9; j++) {
                  const tile = sudoku[i][j];
                  if (typeof tile !== "number") continue;
                  if (tile !== solution[i][j]) {
                    errors[i][j] = true;
                  }
                }
              }
              setErrors(errors);
            }}
          >
            Check Solution
          </button>
          <button
            className={classNames(
              lockNum !== null
                ? "bg-blue-400 text-blue-100"
                : "hover:bg-blue-300 text-blue-700",
              "border border-blue-500 rounded px-2 py-1 focus:outline-none"
            )}
            onClick={() => {
              // null if off, 0 if on but no number, 1-9 if on with number
              if (lockNum !== null) {
                setLockNum(null);
                return;
              }
              const focusTile = focusRef.current;
              if (focusTile) {
                const [i, j] = focusTile;
                const num = sudoku[i][j];
                if (typeof num === "number") {
                  setLockNum(num);
                  return;
                }
              }
              setLockNum(0);
            }}
          >
            Lock Mode
          </button>
        </div>
        <div className="mt-2 grid grid-cols-9 gap-1 w-full max-w-sm">
          {counts.map((count, i) => (
            <button
              key={i}
              className={classNames(
                "pb-1 flex flex-col items-center rounded relative text-blue-800 font-medium text-lg focus:outline-none disabled:opacity-0",
                lockNum !== null && lockNum !== i + 1
                  ? "bg-gray-200 hover:bg-blue-200"
                  : "bg-blue-200 hover:bg-blue-100"
              )}
              onClick={() => {
                if (lockNum !== null) {
                  if (lockNum !== i + 1) {
                    const pos: any = searchFirstNum(sudoku, i + 1);
                    if (pos) {
                      setFocusTile(pos);
                      focusRef.current = pos;
                    }
                    setLockNum(i + 1);
                    return;
                  }
                }
                onNumberClick({ num: i + 1 });
              }}
              disabled={count === 9}
            >
              <span>{i + 1}</span>
              <span className="text-xs text-gray-500">{9 - count}</span>
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
  const {
    setFocusTile,
    sudoku,
    focusTile,
    errors,
    mutable,
    focusRef,
    lockNum,
    setLockNum,
    onNumberClick,
    notesMode,
  } = useSudoku();
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
            const [y, x] = focusTile || [-1, -1];
            const sameBlock =
              Math.floor(y / 3) === Math.floor(row / 3) &&
              Math.floor(x / 3) === Math.floor(col / 3);
            const focus = focusTile ? sudoku[y][x] : null;
            let focusNum: null | number = null;
            if (lockNum) {
              focusNum = lockNum;
            } else {
              focusNum = typeof focus === "number" ? focus : null;
            }
            let bgClass = "";
            if (error) {
              bgClass = "bg-red-200";
            } else if (focusNum) {
              if (tile === focusNum) {
                bgClass = "bg-blue-100";
              } else if (y === row || x === col || sameBlock) {
                bgClass = "bg-blue-50";
              }
            } else if (focus && (y === row || x === col || sameBlock)) {
              bgClass = "bg-blue-50";
            }
            return (
              <li
                key={i}
                className={classNames("aspect-square border-black border")}
              >
                <button
                  className={classNames(
                    "h-full w-full flex justify-center items-center focus:outline-none font-medium relative",
                    !isMutable && "text-blue-600",
                    bgClass
                  )}
                  onClick={() => {
                    if (!lockNum || notesMode === 0) {
                      focusRef.current = [row, col];
                      setFocusTile([row, col]);
                    }
                    if (lockNum !== null) {
                      if (typeof tile !== "number") {
                        if (lockNum !== 0)
                          onNumberClick({ num: lockNum, pos: [row, col] });
                      } else {
                        setLockNum(tile);
                      }
                    }
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
                            className={classNames(
                              getNoteClassName(i, tile.c.length),
                              typeof focusNum === "number" &&
                                focusNum === n &&
                                "bg-blue-200 text-black"
                            )}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-[1px] text-center text-xs text-gray-500">
                        {tile.m.map((n) => (
                          <span
                            key={n}
                            className={classNames(
                              typeof focusNum === "number" &&
                                focusNum === n &&
                                "bg-blue-200 text-black"
                            )}
                          >
                            {n}
                          </span>
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
