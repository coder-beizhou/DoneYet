import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles/index.css";

// 按 window label 决定渲染哪个根组件:main → 主面板,note-* → 便签窗,calendar → 日历大窗。
async function bootstrap() {
  const label = getCurrentWindow().label;
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  if (label === "calendar") {
    const { default: CalendarWindow } = await import("./windows/CalendarWindow");
    root.render(
      <React.StrictMode>
        <CalendarWindow />
      </React.StrictMode>
    );
  } else if (label === "calculator") {
    const { default: CalculatorWindow } = await import("./windows/CalculatorWindow");
    root.render(
      <React.StrictMode>
        <CalculatorWindow />
      </React.StrictMode>
    );
  } else if (label.startsWith("note-")) {
    const { default: NoteWindow } = await import("./windows/NoteWindow");
    root.render(
      <React.StrictMode>
        <NoteWindow />
      </React.StrictMode>
    );
  } else {
    const { default: Dashboard } = await import("./windows/Dashboard");
    root.render(
      <React.StrictMode>
        <Dashboard />
      </React.StrictMode>
    );
  }
}

bootstrap();
