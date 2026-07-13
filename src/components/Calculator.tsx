import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n";

/** 计算器弹窗:支持 +−×÷ %，显示完整计算过程历史。 */
export default function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [fresh, setFresh] = useState(true);
  const t = useT();

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
      // 尝试连续计算
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

  function clear() {
    setDisplay("0");
    setExpression("");
    setFresh(true);
  }

  function backspace() {
    if (fresh) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    if (display.length <= 1) setFresh(true);
  }

  function percent() {
    const v = parseFloat(display) / 100;
    setDisplay(String(v));
    setFresh(true);
  }

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
    <div className="floating-panel-overlay" onClick={onClose}>
      <div className="floating-panel calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-header">
          <span className="modal-title">{t("calc.title")}</span>
          <button className="icon-btn" onMouseDown={(e) => e.stopPropagation()} onClick={onClose} title={t("action.close")}>
            <X size={14} />
          </button>
        </div>
        {/* 计算过程历史 */}
        {history.length > 0 && (
          <div className="calc-history">
            {history.map((h, i) => (
              <div key={i} className="calc-history-item">{h}</div>
            ))}
          </div>
        )}
        {/* 当前表达式 */}
        <div className="calc-expr">{expression || " "}</div>
        {/* 显示 */}
        <div className="cal-display">{display}</div>
        {/* 按键 */}
        <div className="cal-keys">
          {keys.map((k) => (
            <button
              key={k.l}
              className={"cal-key" + (k.cls ? " " + k.cls : "")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={k.fn}
            >
              {k.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
