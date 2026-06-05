// furnace-ui.js — Minecraft furnace GUI interaction

const SMELT_DURATION = 1800;   // 30 min per item (real seconds, scaled)

const FUEL_BURN = {
  oak_log: 16200, spruce_log: 16200, birch_log: 16200,
  jungle_log: 16200, acacia_log: 16200, dark_oak_log: 16200,
  mangrove_log: 16200, cherry_log: 16200, pale_oak_log: 16200,
  charcoal: 86400,
};

const LOG_TYPES = [
  'oak_log','spruce_log','birch_log','jungle_log','acacia_log',
  'dark_oak_log','mangrove_log','cherry_log','pale_oak_log',
];

const MAX_STACK = 64;
const ITEM_TEX  = (item) => `textures/items/${item}.png`;
const ITEM_TOP  = (item) => `textures/items/${item}_top.png`;

// ── 等距 3D 方块渲染 ─────────────────────────────────────────────────
const _texCache = {};
function _loadTex(url) {
  if (_texCache[url]) return _texCache[url];
  const img = new Image(); img.src = url;
  _texCache[url] = img; return img;
}

function _drawIsoBlock(cv, sideImg, topImg, S) {
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  cv.width = S; cv.height = S;
  c.clearRect(0, 0, S, S);
  const T = 16;
  // 右侧面 (80%)
  c.save(); c.globalAlpha = 0.80;
  c.setTransform(S/(2*T), -S/(4*T), 0, S/(2*T), S/2, S/2);
  c.drawImage(sideImg, 0, 0, T, T); c.restore();
  // 左侧面 (60%)
  c.save(); c.globalAlpha = 0.60;
  c.setTransform(S/(2*T), S/(4*T), 0, S/(2*T), 0, S/4);
  c.drawImage(sideImg, 0, 0, T, T); c.restore();
  // 顶面 (100%)
  c.save(); c.globalAlpha = 1.0;
  c.setTransform(S/(2*T), -S/(4*T), S/(2*T), S/(4*T), 0, S/4);
  c.drawImage(topImg, 0, 0, T, T); c.restore();
}

function _renderItemCanvas(el, item, size) {
  // 清除旧 canvas/img，重建
  el.querySelectorAll('canvas, img').forEach(n => n.remove());
  const cv = document.createElement('canvas');
  cv.className = 'fslot-canvas';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block;';
  el.appendChild(cv);

  if (item === 'charcoal') {
    const img = _loadTex(ITEM_TEX('charcoal'));
    const draw = () => {
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      cv.width = size; cv.height = size;
      c.clearRect(0, 0, size, size);
      c.drawImage(img, 0, 0, size, size);
    };
    img.complete ? draw() : (img.onload = draw);
    return;
  }

  const side = _loadTex(ITEM_TEX(item));
  const top  = _loadTex(ITEM_TOP(item));
  const draw = () => _drawIsoBlock(cv, side, top, size);
  if (side.complete && top.complete) { draw(); }
  else {
    side.onload = () => { if (top.complete) draw(); };
    top.onload  = () => { if (side.complete) draw(); };
  }
}

// ── DOM refs ─────────────────────────────────────────────────────────
let _gui, _inner, _slotInput, _slotFuel, _slotOutput;
let _fireBarImg, _arrowImg, _heldDiv;
let _domReady = false;
let _inputRefreshTimer = null;

function _initDom() {
  if (_domReady) return;
  _gui        = document.getElementById('furnace-gui');
  _inner      = document.getElementById('furnace-gui-inner');
  _slotInput  = document.getElementById('fslot-input');
  _slotFuel   = document.getElementById('fslot-fuel');
  _slotOutput = document.getElementById('fslot-output');
  _fireBarImg = document.querySelector('#ffuel-bar img');
  _arrowImg   = document.querySelector('#fsmelt-arrow img');
  _heldDiv    = document.getElementById('furnace-held');
  _domReady   = true;
}

// ── Open / Close ──────────────────────────────────────────────────────
function openFurnaceUI() {
  _initDom();
  if (!_gui) return;
  furnaceUIOpen = true;
  _gui.classList.remove('hidden');
  renderFurnace();
  document.addEventListener('mousemove', _onFurnaceMouseMove);
}

function closeFurnaceUI() {
  _initDom();
  if (!_gui) return;
  furnaceUIOpen = false;
  _gui.classList.add('hidden');
  if (furnaceHeldItem) { furnaceHeldItem = null; _updateHeld(); }
  document.removeEventListener('mousemove', _onFurnaceMouseMove);
  if (typeof _furnaceStateSave === 'function') _furnaceStateSave();
}

window.openFurnaceUI  = openFurnaceUI;
window.closeFurnaceUI = closeFurnaceUI;

// ── Slot rendering ────────────────────────────────────────────────────
function _renderSlot(el, stack) {
  if (!stack || stack.count <= 0) {
    // 清空：移除内容 + 属性
    el.innerHTML = '';
    el.removeAttribute('data-cur-item');
    el.classList.remove('has-item');
    return;
  }
  el.classList.add('has-item');
  // 只在 item 类型变化时重绘 canvas（避免每帧重绘）
  if (el.getAttribute('data-cur-item') !== stack.item) {
    el.setAttribute('data-cur-item', stack.item);
    _renderItemCanvas(el, stack.item, 54);
  }
  let badge = el.querySelector('.fslot-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'fslot-count';
    el.appendChild(badge);
  }
  badge.textContent = stack.count > 1 ? stack.count : '';
}

function renderFurnace() {
  _initDom();
  if (!_gui) return;
  _renderSlot(_slotInput,  furnaceInputSlot);
  _renderSlot(_slotFuel,   furnaceFuelSlot);
  _renderSlot(_slotOutput, furnaceOutputSlot);

  // 火焰高度条（从底向上 clip）
  const fuelRatio = fuelTotalSeconds > 0 ? fuelSeconds / fuelTotalSeconds : 0;
  if (_fireBarImg) {
    _fireBarImg.style.clipPath = `inset(${((1-Math.min(fuelRatio,1))*100).toFixed(1)}% 0 0 0)`;
  }

  // 烧制进度箭头（从左向右展开）
  const smelting   = fuelSeconds > 0
    && furnaceInputSlot  && furnaceInputSlot.count  > 0
    && !(furnaceOutputSlot && furnaceOutputSlot.count >= MAX_STACK);
  const smeltRatio = smelting ? Math.min(smeltProgress / SMELT_DURATION, 1) : 0;
  if (_arrowImg) {
    _arrowImg.style.clipPath = `inset(0 ${((1-smeltRatio)*100).toFixed(1)}% 0 0)`;
  }

  _updateHeld();
}
window.renderFurnace = renderFurnace;

// ── 自动点燃燃料（仅当输入槽有物品时才消耗燃料）────────────────────────
function _tryAutoStartFuel() {
  if (fuelSeconds > 0) return;
  // 输入槽必须有物品，否则燃料留在槽里等待
  if (!furnaceInputSlot || furnaceInputSlot.count <= 0) return;

  let candidate = null;
  if (furnaceFuelSlot && furnaceFuelSlot.count > 0) {
    candidate = furnaceFuelSlot;
  } else if (fuelQueue.length > 0) {
    furnaceFuelSlot = fuelQueue.shift();
    candidate = furnaceFuelSlot;
  }
  if (!candidate) return;

  const burn = FUEL_BURN[candidate.item] || 0;
  if (!burn) return;

  fuelTotalSeconds = burn;
  fuelSeconds      = burn;
  candidate.count--;
  if (candidate.count <= 0) furnaceFuelSlot = null;

  if (furnaceUIOpen) renderFurnace();
  if (typeof _furnaceStateSave === 'function') _furnaceStateSave();
}
window._tryAutoStartFuel = _tryAutoStartFuel;

// ── 输入槽自动补货（几乎即时）────────────────────────────────────────
function _scheduleInputRefresh(prevType) {
  clearTimeout(_inputRefreshTimer);
  _inputRefreshTimer = setTimeout(() => {
    if (!furnaceInputSlot || furnaceInputSlot.count <= 0) {
      const nextType = Math.random() < 0.7
        ? prevType
        : LOG_TYPES[Math.floor(Math.random() * LOG_TYPES.length)];
      furnaceInputSlot = { item: nextType, count: 1 };
      // 输入槽补货后，如果有燃料但还没点燃，尝试点燃
      if (fuelSeconds <= 0) _tryAutoStartFuel();
      if (furnaceUIOpen) renderFurnace();
    }
  }, 100);
}

// ── Tick（每帧由 updateFurnaceDecay 调用）────────────────────────────
function tickFurnace(dt) {
  // 每帧检测：若有燃料待点燃且输入槽有料，自动点燃
  if (fuelSeconds <= 0 && furnaceFuelSlot && furnaceFuelSlot.count > 0
      && furnaceInputSlot && furnaceInputSlot.count > 0) {
    _tryAutoStartFuel();
  }

  const canSmelt = fuelSeconds > 0
    && furnaceInputSlot && furnaceInputSlot.count > 0
    && !(furnaceOutputSlot && furnaceOutputSlot.count >= MAX_STACK);

  if (!canSmelt) {
    if (smeltProgress > 0 && fuelSeconds <= 0) smeltProgress = 0;
    if (furnaceUIOpen) renderFurnace();
    return;
  }

  smeltProgress += dt;
  if (smeltProgress >= SMELT_DURATION) {
    smeltProgress -= SMELT_DURATION;
    const prevType = furnaceInputSlot.item;
    furnaceInputSlot.count--;
    if (furnaceInputSlot.count <= 0) {
      furnaceInputSlot = null;
      _scheduleInputRefresh(prevType);
    }
    furnaceOutputSlot = furnaceOutputSlot
      ? { item: 'charcoal', count: Math.min(furnaceOutputSlot.count + 1, MAX_STACK) }
      : { item: 'charcoal', count: 1 };
  }

  if (furnaceUIOpen) renderFurnace();
}
window.tickFurnace = tickFurnace;

// ── ItemStack 交互 ────────────────────────────────────────────────────
function _onSlotClick(slotName, e) {
  e.preventDefault();
  e.stopPropagation();
  const isRight = e.button === 2;

  // ── 产物槽：只能取出 ──────────────────────────────────────────────
  if (slotName === 'output') {
    if (!furnaceOutputSlot || furnaceOutputSlot.count <= 0) return;
    if (!furnaceHeldItem) {
      furnaceHeldItem = isRight
        ? { item: furnaceOutputSlot.item, count: Math.ceil(furnaceOutputSlot.count / 2) }
        : { ...furnaceOutputSlot };
      furnaceOutputSlot = isRight
        ? { item: furnaceOutputSlot.item, count: furnaceOutputSlot.count - Math.ceil(furnaceOutputSlot.count/2) }
        : null;
    } else if (furnaceHeldItem.item === 'charcoal' && furnaceHeldItem.count < MAX_STACK) {
      const take = Math.min(isRight ? 1 : furnaceOutputSlot.count, MAX_STACK - furnaceHeldItem.count, furnaceOutputSlot.count);
      furnaceHeldItem.count += take;
      furnaceOutputSlot.count -= take;
    }
    if (furnaceOutputSlot && furnaceOutputSlot.count <= 0) furnaceOutputSlot = null;
    renderFurnace();
    if (typeof _furnaceStateSave === 'function') _furnaceStateSave();
    return;
  }

  const isInput  = slotName === 'input';
  const isValid  = (item) => isInput ? LOG_TYPES.includes(item) : (item in FUEL_BURN);
  const getSlot  = () => isInput ? furnaceInputSlot  : furnaceFuelSlot;
  const setSlot  = (v) => { if (isInput) furnaceInputSlot = v; else furnaceFuelSlot = v; };

  let slot = getSlot();

  if (!furnaceHeldItem) {
    // ── 无持有：从槽里拿 ────────────────────────────────────────────
    if (!slot) return;
    const prevItem = slot.item;
    if (isRight) {
      const half = Math.ceil(slot.count / 2);
      furnaceHeldItem = { item: slot.item, count: half };
      slot = slot.count - half > 0 ? { item: slot.item, count: slot.count - half } : null;
    } else {
      furnaceHeldItem = { ...slot };
      slot = null;
    }
    setSlot(slot);
    // 输入槽被取空时自动补货
    if (isInput && !furnaceInputSlot) {
      _scheduleInputRefresh(prevItem);
    }
  } else {
    // ── 持有物品：放入槽 ────────────────────────────────────────────
    if (!isValid(furnaceHeldItem.item)) { renderFurnace(); return; }

    if (!slot) {
      const place = isRight ? 1 : furnaceHeldItem.count;
      slot = { item: furnaceHeldItem.item, count: place };
      furnaceHeldItem.count -= place;
    } else if (slot.item === furnaceHeldItem.item) {
      const place    = isRight ? 1 : furnaceHeldItem.count;
      const canPlace = Math.min(place, MAX_STACK - slot.count);
      slot.count            += canPlace;
      furnaceHeldItem.count -= canPlace;
    } else if (!isRight) {
      // 不同类型左键：置换
      const tmp = { ...slot };
      slot = { ...furnaceHeldItem };
      furnaceHeldItem = tmp;
    }
    if (furnaceHeldItem && furnaceHeldItem.count <= 0) furnaceHeldItem = null;
    if (slot && slot.count <= 0) slot = null;
    setSlot(slot);

    // 放入燃料槽后尝试点燃（需要输入槽有物品）
    if (!isInput) _tryAutoStartFuel();
    // 放入输入槽后若有燃料待点燃，尝试点燃
    if (isInput) _tryAutoStartFuel();
  }

  renderFurnace();
  if (typeof _furnaceStateSave === 'function') _furnaceStateSave();
}

// ── 持有物品跟随鼠标 ──────────────────────────────────────────────────
function _updateHeld() {
  _initDom();
  if (!_heldDiv) return;
  if (!furnaceHeldItem || furnaceHeldItem.count <= 0) {
    _heldDiv.style.display = 'none';
    return;
  }
  _heldDiv.style.display = 'block';
  if (_heldDiv.getAttribute('data-cur-item') !== furnaceHeldItem.item) {
    _heldDiv.setAttribute('data-cur-item', furnaceHeldItem.item);
    _heldDiv.querySelectorAll('canvas').forEach(n => n.remove());
    _renderItemCanvas(_heldDiv, furnaceHeldItem.item, 54);
  }
  let badge = _heldDiv.querySelector('span');
  if (!badge) { badge = document.createElement('span'); _heldDiv.appendChild(badge); }
  badge.textContent = furnaceHeldItem.count > 1 ? furnaceHeldItem.count : '';
}

function _onFurnaceMouseMove(e) {
  if (!_heldDiv) return;
  _heldDiv.style.left = (e.clientX + 8) + 'px';
  _heldDiv.style.top  = (e.clientY + 8) + 'px';
}

// ── 初始化 ─────────────────────────────────────────────────────────
(function _setupFurnaceUI() {
  function _attach() {
    _initDom();
    if (!_gui) return;
    _gui.addEventListener('mousedown', (e) => { if (e.target === _gui) closeFurnaceUI(); });
    _gui.addEventListener('contextmenu', (e) => e.preventDefault());
    const closeBtn = document.getElementById('furnace-close');
    if (closeBtn) closeBtn.addEventListener('click', closeFurnaceUI);
    [['input', _slotInput], ['fuel', _slotFuel], ['output', _slotOutput]].forEach(([name, el]) => {
      if (el) el.addEventListener('mousedown', (e) => _onSlotClick(name, e));
    });
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', _attach)
    : _attach();
})();
