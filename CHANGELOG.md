# Changelog

## v1.1.0 (2026-07-13)

### 国际化 + 彩蛋
- 中英文 i18n(设置→语言切换,零新依赖):品牌名 办了么/DoneYet、全站文案、日历 24 节气 + 7 节日双语、托盘菜单/窗口标题/提醒通知按语言动态切换;冷启动 lang.txt 持久化
- 花体 BEIZHOU 署名藏于 4 角(Settings 页脚/状态栏/便签/日历标题栏);连点 5 次或 Konami 码(↑↑↓↓←→←→BA)解锁彩纸 + 彩虹强调色闪烁彩蛋

### 正确性修复
- DB 事务: reminders create/update/delete、notes/todos reorder 多语句操作包事务,中途失败整体回滚
- 删便签改"墓碑"(仅置 deleted_at,不硬删子表)+ undelete 命令:Ctrl+Z 完整恢复便签+其待办/提醒,Ctrl+Y 重做真正可用(原 redo 是死的);所有 todos/reminders 查询过滤墓碑便签子项(不显示/不通知)
- 提醒通知顺序:emit→OS 通知→mark_fired,通知失败不丢一次性提醒(旧版会永久丢)
- todos 索引(idx_todos_note / idx_todos_due):scheduler 每 30s 的 list_overdue + 开日历的 list_by_note 命中索引
- 排序持久化: notes/todos 批量 reorder 命令 + 乐观更新(todos 干掉旧 N+1 顺序 updateTodo,50 条 50 次往返→1 次)
- load() 竞态: 请求序号防并发旧响应覆盖
- data:changed 去重: 单次便签保存由 3× list_notes 降为 1×
- 关窗不丢内容: save 失败则不关窗 + 显示"保存失败",保留未保存正文
- NoteWindow: 便签在别处被删时销毁空白隐身窗

### 打磨
- 主题色硬编码修复: toast/工具栏激活态/待办编辑行 4 处改用 color-mix(var(--accent)),非深空主题不再残留 indigo
- 焦点环 a11y: 键盘聚焦显示强调色细环(原 outline:none !important 抹掉了)
- 死依赖清理: tauri-plugin-store / thiserror / @tiptap/extension-image / clsx / @tauri-apps/plugin-opener
- tokio features 由 full 收窄到实际所需;[profile.release] LTO + 单 codegen-unit + strip(二进制减 20-40%)
- set_language 写 lang.txt 改 tokio::fs(不阻塞 async worker)

## v1.0.0 (2026-07-01)

### 便签
- 富文本编辑器(TipTap: 加粗/斜体/删除线/标题/列表/待办清单/高亮/链接/代码)
- 工具栏默认折叠,点击 Aa 展开
- Markdown 双向存储(content_md + content_json)
- 色板(6色)、毛玻璃无边框窗口、8向缩放、拖拽移动
- 自动保存(800ms 防抖)+ 关窗空便签自动删除
- 双击便签卡打开、滑动删除、拖拽排序
- 可选日期(加日期后自动进日历)
- resize/move 即时存几何

### 待办
- 独立待办(不强制归属便签)
- 标题 + 正文 + 截止时间
- 勾选/取消勾选、清除已完成
- 双击行内编辑(竖向布局:标题/正文/日期+保存取消)
- 到期 scheduler 弹通知(内存去重)
- 日历中始终显示(未勾黄色/已勾绿色),可直接打勾
- 拖拽排序

### 日历
- 月历大窗口(72% 桌面尺寸,可拖动/缩放)
- 24 节气 + 7 个法定假期(元旦/春节/清明/劳动节/端午/中秋/国庆)
- 便签/待办/提醒联动(agenda 聚合)
- 重复提醒按 occurrence 展开到每日
- 格子折叠/选中展开+滚轮滚动
- 选中格子再点击=新建(选便签/待办/提醒)
- 日历内待办可直接打勾
- 日期号 16px、格子线/数字/事项加深

### 提醒
- 一次性/每天/每周/每月/每年重复
- 后台 scheduler(每30s轮询,window级追踪,panic隔离)
- 到点弹 OS 通知 + 唤起主窗 + toast
- 编辑重复规则(可改 daily↔weekly↔清除)
- 防通知风暴(advance_from 跳过已错过周期)
- 双击行内编辑(标题/时间/重复)
- 拖拽排序

### 分类标签(书签)
- 左侧书签式标签栏(贴主界面左边缘外侧)
- 折叠时显示首字、hover 展开全名
- 新建分类(≤7字,内联输入框,颜色轮转)
- 右键删除(滑出动画)
- 便签可按分类筛选

### 设置
- 8 套主题风格(深空/碧海/青瓷/薄荷/暖阳/樱粉/葡紫/岩灰)
- 不透明度滑块(40%-100%)
- 关闭按钮行为(直接退出/最小化到托盘)
- 开机自启
- 固定到桌面底层(setAlwaysOnBottom)
- 字号(小/中/大)
- 便签默认颜色
- 跨窗口实时同步(localStorage storage 事件)
- 首帧不闪(模块级 applySettingsCss)

### 交互
- 统一 SwipeToDelete 组件(便签/待办/提醒)
  - 按住0.3s竖拖排序 / 横滑展开垃圾桶
  - 展开后 ✕取消/✓确认删除(iOS 风格滑出动画)
  - 点外部=取消
  - 透明垃圾桶图标触发器(hover 变红)
- Ctrl+Z 撤销 / Ctrl+Y 重做(全局 undoStore)
- 操作日志时间轴(创建✚/编辑✎/完成✓/删除✕/启用🔔/停用🔕,颜色区分)
- 计算器独立窗口(计算过程历史+表达式显示)
- 主界面贴屏幕右边细长条(320宽×80%高)
- 无 Mica/无系统阴影(透明悬挑无框)
- 启动不闪(visible:false → 几何定好后 show)
- 禁止最大化/缩放(防 Aero Snap)

### 基础设施
- 迁移追踪系统(schema_migrations 表,幂等执行)
- 0001: 全表一次建好(sticky_notes/todos/reminders/repeats/categories/habits/countdowns/templates/history)
- 0002: todos note_id 可空+content 列; sticky_notes date 列
- 0003: operation_log 表(操作日志)
- 单例(tauri-plugin-single-instance)
- tauri-plugin-autostart(开机自启)
- tauri-plugin-log(日志后端)
- tauri-plugin-notification(OS 通知)
- tauri-plugin-global-shortcut(Ctrl+Shift+N/M)
- SQLite WAL + busy_timeout(5s) + 外键
- GNU 工具链(rlib-only,避免 mingw ld export ordinal 限制)
