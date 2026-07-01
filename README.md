# 办了么 / DoneYet

> 一款桌面端便签 + 待办 + 日历 + 提醒一体化工具，对标敬业签，本地优先，丝滑动画。

## 功能

- **便签** — 富文本编辑(TipTap)、色板、毛玻璃无边框窗口、自动保存、多窗口
- **待办** — 独立待办(不强制归属便签)、正文、截止时间、勾选、清除已完成
- **日历** — 月历视图、节气/法定假期标注、便签/待办/提醒联动、格子折叠展开+滚轮、点击日期新建(选便签/待办/提醒)
- **提醒** — 一次性/每天/每周/每月/每年重复、后台 scheduler 自动弹通知、到点唤起主窗
- **分类标签(书签)** — 左侧书签式标签栏、hover 展开文字、新建≤7字、右键删除
- **设置** — 8 套主题风格、不透明度滑块、关闭按钮行为(退出/最小化到托盘)、开机自启、固定到桌面底层
- **操作日志时间轴** — 记录创建/编辑/完成/删除等操作，颜色+符号区分
- **计算器** — 独立窗口，显示计算过程历史
- **滑动删除** — 统一 SwipeToDelete 组件：按住0.3s竖拖排序 / 横滑展开垃圾桶确认删除
- **拖拽排序** — 便签/待办/提醒均可按住0.3s拖拽上下排序
- **Ctrl+Z/Ctrl+Y** — 撤销/重做
- **单例** — 不允许多开，第二实例聚焦已有窗口
- **跨窗口同步** — 设置/数据变更即时同步到所有窗口

## 技术栈

- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + TipTap + dayjs
- **后端**: Rust + Tauri v2 + SQLx (SQLite/WAL) + Tokio
- **插件**: tauri-plugin-notification / autostart / single-instance / log / global-shortcut

## 构建

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 打包(release)
npm run tauri build
```

打包产物在 `src-tauri/target/release/bundle/` 下。

## 下载

- **exe 安装版**: `办了么_1.0.0_x64-setup.exe`
- **zip 免安装版**: `办了么_1.0.0_x64.zip`（解压即用）

## License

MIT
