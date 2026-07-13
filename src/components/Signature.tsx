import { useState, type CSSProperties } from "react";
import { useT } from "../i18n";
import { useUiStore } from "../stores/uiStore";
import { triggerEasterEgg } from "../lib/easterEgg";

interface Props {
  /** footer=页脚大号花体;inline=角落小号低透明。 */
  variant?: "footer" | "inline";
  style?: CSSProperties;
}

/**
 * 花体 BEIZHOU 署名。连点 5 次解锁彩蛋(彩纸 + 彩虹闪烁 + toast);
 * 第 3、4 次给"再点 N 下"提示,引导发现。title 悬停说明作者。
 */
export default function Signature({ variant = "footer", style }: Props) {
  const t = useT();
  const [count, setCount] = useState(0);

  function onClick() {
    const n = count + 1;
    if (n >= 5) {
      setCount(0);
      triggerEasterEgg();
    } else {
      setCount(n);
      if (n >= 3) useUiStore.getState().push(t("egg.hint", { n: 5 - n }));
    }
  }

  return (
    <span
      className={"signature" + (variant === "inline" ? " signature-inline" : "")}
      style={style}
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={t("signature.tip")}
    >
      BEIZHOU
    </span>
  );
}
