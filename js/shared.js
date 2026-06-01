// shared.js — cross-module mutable globals (var for cross-script access)
// Load FIRST before all other JS modules

var furnaceLevel  = 50;       // controlled by fire slider
var lightLevel    = -64;      // driven by furnaceLevel
var userUnmuted   = false;
var mouseX = -9999, mouseY = -9999;
var front, back;              // video layers — assigned in video.js
var state = 'sleepRight';
var canvas, ctx;              // flame canvas — assigned in particles.js
var _cachedRect   = null;
var particles     = [];
var _maskDragCol  = -1;

// furnace geometry (mutable in editor mode)
var FIRE_FX_L  = 0.430;
var FIRE_FX_R  = 0.483;
var FIRE_FY    = 0.31;
var FIRE_ANGLE = -38;
var ARCH_HEIGHT = 0.018;

// particle pool limits (read by particles.js + main.js)
var PARTICLE_MIN = 0;
var PARTICLE_MAX = 12;

// debug flags (read by main.js draw loop)
var DEBUG_LINE = false;

// workbench hover state (written by lighting.js mousemove, read by main.js)
var _wbHovered = false;
// title hover state（鼠标在 title 上时 true，与 _wbHovered 互斥）
var _titleHovered = false;
// workbench expanded state (true = title 居中展开)
var _wbExpanded = false;
// workbench closing state (true = 正在播放收起动画)
var _wbClosing  = false;
// workbench phase2 (true = title 已上移 + panel 已展开)
var _wbPhase2   = false;
// panel 尺寸缓存（由 layoutWbPanel 每帧更新）
var _panelW = 0, _panelH = 0, _panelL = 0;
// body_final_cut.png 宽高比
var WB_BODY_ASPECT = 785 / 1283;
// 展开态 title 宽度（vw）
var WB_TITLE_EXPAND_VW = 22;
// 宽屏时 body 相对 title 的宽度比（用于允许填满高度）
var WB_PANEL_TITLE_W_RATIO = 1.17;
// 窄屏 / F12：body 宽度 = title 实际宽度 × 此值（1.0 = 与 title 等宽）
var WB_PANEL_TITLE_W_RATIO_NARROW = 1.0;
// innerWidth 低于此值走窄屏逻辑
var WB_NARROW_BREAKPOINT = 1700;

// ── body 菜单栏位布局（相对 body_final_cut.png，0~1）────────────────
var WB_SLOT_COUNT = 9;
// 第 5~9 栏（索引 4~8）整体上移量，相对 body 高度
var WB_SLOT_LOWER_U    = 0.006;
var WB_SLOT_LOWER_FROM = 4;
// 用户标定的两个参考栏位；其余 8 个由 mpGetSlotRect() 线性推导
var WB_SLOT_REF = [
  { l: 0.0575, t: 0.0323, w: 0.8859, h: 0.0821 },
  { l: 0.0575, t: 0.1364, w: 0.8885, h: 0.0868 },
];

// ── 返回按钮位置（相对 body_final_cut.png，0~1）────────────────────
// 调好后关掉 DEBUG_BACK_BTN 即可正式化
var DEBUG_BACK_BTN = false;
var WB_BACK_BTN = { l: 0.8120, t: 0.3571, w: 0.1224, h: 0.4969 };

// ── 栏位拖拽编辑器（调好后设 DEBUG_SLOT_DRAG=false）────────────────
var DEBUG_SLOT_DRAG = false;
var _wbSlotEditBoxes = [
  { l: 0.0575, t: 0.0323, w: 0.8859, h: 0.0821 },
  { l: 0.0575, t: 0.1364, w: 0.8885, h: 0.0868 },
];
var _slotDrag = { idx: -1, mode: '', sx: 0, sy: 0, box: null };

// ── 工作台角点拖拽编辑器 ──────────────────────────────────────────────
// 设为 true 开启拖拽调整；调好后设回 false 并将坐标填入 _wbFreeCorners
var DEBUG_WB_DRAG = false;
// 4个角的视频相对坐标 [vx, vy]（顺序：BL左下、BR右下、TR右上、TL左上）
// 工作台顶面是普通四边形（非平行四边形），只能用自由角点描述
var _wbFreeCorners = [
  [0.175, 0.514],  // BL 左下（向左 -0.018）
  [0.283, 0.378],  // BR 右下
  [0.218, 0.230],  // TR 右上
  [0.126, 0.360],  // TL 左上（+0.02 向右缩）
];
// 当前正在拖动的角索引（-1 表示没有拖动）
var _wbDragIdx = -1;

// 侧面线段长度（视频高度比例）——左右独立控制
var WB_SIDE_H_L = 0.14;  // 左侧线长度
var WB_SIDE_H_R = 0.125;  // 右侧线长度
// 侧面两条竖线的倾斜角（从屏幕"正下方"逆时针偏转，负值=逆时针，正值=顺时针）
var WB_LEFT_TILT  = 55;    // 左线：原 -30° 顺时针 30° = 0°（竖直向下）
var WB_RIGHT_TILT = 40;   // 右线：从竖直向下顺时针 30°
// left-side extra extension (fraction of video width) — shifts ONLY the two left
// vertices further left, making the top face a trapezoid without touching the right side
var WB_LEFT_EXT = 0.0000;
