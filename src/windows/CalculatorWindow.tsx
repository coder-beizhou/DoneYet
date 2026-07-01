import { useState } from "react";
import { X } from "lucide-react";
import { startDrag, win } from "../lib/window";
import { useApplySettings } from "../stores/settingsStore";

/** 计算器独立窗口:可拖动/缩放/关闭,不挡主界面。 */
export default function CalculatorWindow() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [fresh, setFresh] = useState(true);

  useApplySettings();

  function inputDigit(d: string) {
    if (fresh) {
      setDisplay(d === "." ? "0." : d);
      setFresh(false);
    } else {
      if (d === "." && display.includes(".")) return;
      setDisplay(display === "0" && d !== "." ? d : display + d);
    }
  }

  function compute(a: number, b: number, operator: string): number {
    switch (operator) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function inputOperator(o: string) {
    const cur = parseFloat(display);
    if (expression && !fresh) {
      const parts = expression.split(" ");
      if (parts.length >= 2) {
        const prev = parseFloat(parts[0]);
        const prevOp = parts[1];
        const result = compute(prev, cur, prevOp);
        setDisplay(String(result));
        setExpression(`${result} ${o}`);
      } else {
        setExpression(`${cur} ${o}`);
      }
    } else {
      setExpression(`${cur} ${o}`);
    }
    setFresh(true);
  }

  function equals() {
    if (!expression) return;
    const parts = expression.split(" ");
    if (parts.length < 2) return;
    const prev = parseFloat(parts[0]);
    const op = parts[1];
    const cur = parseFloat(display);
    const result = compute(prev, cur, op);
    const calc = `${prev} ${op} ${cur} = ${result}`;
    setHistory([calc, ...history].slice(0, 20));
    setDisplay(isNaN(result) ? "Error" : String(result));
    setExpression("");
    setFresh(true);
  }

  function clear() { setDisplay("0"); setExpression(""); setFresh(true); }
  function backspace() {
    if (fresh) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    if (display.length <= 1) setFresh(true);
  }
  function percent() { setDisplay(String(parseFloat(display) / 100)); setFresh(true); }

  const keys = [
    { l: "AC", fn: clear, cls: "cal-key-fn" },
    { l: "⌫", fn: backspace, cls: "cal-key-fn" },
    { l: "%", fn: percent, cls: "cal-key-fn" },
    { l: "÷", fn: () => inputOperator("÷"), cls: "cal-key-op" },
    { l: "7", fn: () => inputDigit("7") },
    { l: "8", fn: () => inputDigit("8") },
    { l: "9", fn: () => inputDigit("9") },
    { l: "×", fn: () => inputOperator("×"), cls: "cal-key-op" },
    { l: "4", fn: () => inputDigit("4") },
    { l: "5", fn: () => inputDigit("5") },
    { l: "6", fn: () => inputDigit("6") },
    { l: "−", fn: () => inputOperator("−"), cls: "cal-key-op" },
    { l: "1", fn: () => inputDigit("1") },
    { l: "2", fn: () => inputDigit("2") },
    { l: "3", fn: () => inputDigit("3") },
    { l: "+", fn: () => inputOperator("+"), cls: "cal-key-op" },
    { l: "0", fn: () => inputDigit("0"), cls: "cal-key-zero" },
    { l: ".", fn: () => inputDigit(".") },
    { l: "=", fn: equals, cls: "cal-key-eq" },
  ];

  return (
    <div className="calc-win">
      <div className="titlebar" onMouseDown={startDrag}>
        <span className="title">计算器</span>
        <div className="titlebar-spacer" />
        <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={() => win.close()} title="关闭">
          <X size={14} />
        </button>
      </div>
      {history.length > 0 && (
        <div className="calc-history">
          {history.map((h, i) => (
            <div key={i} className="calc-history-item">{h}</div>
          ))}
        </div>
      )}
      <div className="calc-expr">{expression || " "}</div>
      <div className="cal-display">{display}</div>
      <div className="cal-keys">
        {keys.map((k) => (
          <button key={k.l} className={"cal-key" + (k.cls ? " " + k.cls : "")} onClick={k.fn}>
            {k.l}
          </button>
        ))}
      </div>
    </div>
  );
}
