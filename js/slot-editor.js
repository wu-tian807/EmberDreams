// slot-editor.js — 两个栏位框：相对 body 拖拽移动 + 右下角缩放

(function () {
  const MIN = 0.02;

  function innerRect() {
    const el = document.getElementById('wb-panel-inner');
    return el ? el.getBoundingClientRect() : null;
  }

  function toNorm(clientX, clientY) {
    const r = innerRect();
    if (!r || r.width <= 0 || r.height <= 0) return null;
    return {
      x: (clientX - r.left) / r.width,
      y: (clientY - r.top)  / r.height,
    };
  }

  function clampBox(b) {
    b.w = Math.max(MIN, Math.min(1, b.w));
    b.h = Math.max(MIN, Math.min(1, b.h));
    b.l = Math.max(0, Math.min(1 - b.w, b.l));
    b.t = Math.max(0, Math.min(1 - b.h, b.t));
  }

  function fmtBox(b) {
    const f = (n) => Number(n.toFixed(4));
    return `{ l: ${f(b.l)}, t: ${f(b.t)}, w: ${f(b.w)}, h: ${f(b.h)} }`;
  }

  function updateHud() {
    const hud = document.getElementById('wb-slot-edit-hud');
    if (!hud) return;
    const lines = _wbSlotEditBoxes.map((b, i) => `  /* #${i + 1} */ ${fmtBox(b)}`);
    hud.textContent =
      'DEBUG_SLOT_DRAG — 拖框移动，拖右下角缩放\n' +
      '_wbSlotEditBoxes = [\n' + lines.join(',\n') + '\n];';
  }

  function applyBoxStyle(el, b) {
    el.style.left   = (b.l * 100) + '%';
    el.style.top    = (b.t * 100) + '%';
    el.style.width  = (b.w * 100) + '%';
    el.style.height = (b.h * 100) + '%';
  }

  function ensureEditorDom() {
    const inner = document.getElementById('wb-panel-inner');
    if (!inner) return null;

    let root = document.getElementById('wb-slot-editor');
    if (!root) {
      root = document.createElement('div');
      root.id = 'wb-slot-editor';

      _wbSlotEditBoxes.forEach((b, i) => {
        const box = document.createElement('div');
        box.className = 'wb-slot-edit-box';
        box.dataset.idx = String(i);

        const label = document.createElement('span');
        label.className = 'wb-slot-edit-label';
        label.textContent = '#' + (i + 1);
        box.appendChild(label);

        const handle = document.createElement('div');
        handle.className = 'wb-slot-edit-handle br';
        handle.dataset.role = 'resize';
        box.appendChild(handle);

        root.appendChild(box);
      });

      inner.appendChild(root);

      const hud = document.createElement('pre');
      hud.id = 'wb-slot-edit-hud';
      document.body.appendChild(hud);
    }

    root.querySelectorAll('.wb-slot-edit-box').forEach((el, i) => {
      applyBoxStyle(el, _wbSlotEditBoxes[i]);
    });
    updateHud();
    return root;
  }

  function slotEditShow(show) {
    const root = document.getElementById('wb-slot-editor');
    const hud  = document.getElementById('wb-slot-edit-hud');
    const menu = document.getElementById('wb-menu');
    if (root) root.style.display = show ? 'block' : 'none';
    if (hud)  hud.style.display  = show ? 'block' : 'none';
    if (menu) menu.style.display = show ? 'none' : '';
    if (show) ensureEditorDom();
  }

  window.slotEditRefresh = function () {
    if (!DEBUG_SLOT_DRAG) return;
    ensureEditorDom();
  };

  window.addEventListener('mousedown', (e) => {
    if (!DEBUG_SLOT_DRAG || !_wbPhase2) return;
    const panel = document.getElementById('wb-panel');
    if (!panel || !panel.classList.contains('open')) return;
    if (!e.target.closest('#wb-slot-editor')) return;

    const boxEl = e.target.closest('.wb-slot-edit-box');
    if (!boxEl) return;

    const idx = parseInt(boxEl.dataset.idx, 10);
    const n = toNorm(e.clientX, e.clientY);
    if (!n || idx < 0 || idx > 1) return;

    _slotDrag.idx  = idx;
    _slotDrag.sx   = n.x;
    _slotDrag.sy   = n.y;
    _slotDrag.box  = { ..._wbSlotEditBoxes[idx] };
    _slotDrag.mode = e.target.dataset.role === 'resize' ? 'resize' : 'move';

    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('mousemove', (e) => {
    if (!DEBUG_SLOT_DRAG || _slotDrag.idx < 0) return;

    const n = toNorm(e.clientX, e.clientY);
    if (!n) return;

    const b = _wbSlotEditBoxes[_slotDrag.idx];
    const dx = n.x - _slotDrag.sx;
    const dy = n.y - _slotDrag.sy;
    const s  = _slotDrag.box;

    if (_slotDrag.mode === 'move') {
      b.l = s.l + dx;
      b.t = s.t + dy;
    } else {
      b.w = s.w + dx;
      b.h = s.h + dy;
      b.l = s.l;
      b.t = s.t;
    }

    clampBox(b);

    const el = document.querySelector(`.wb-slot-edit-box[data-idx="${_slotDrag.idx}"]`);
    if (el) applyBoxStyle(el, b);
    updateHud();

    document.body.style.cursor = _slotDrag.mode === 'resize' ? 'nwse-resize' : 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    if (_slotDrag.idx >= 0) {
      _slotDrag.idx = -1;
      document.body.style.cursor = 'crosshair';
    }
  });

  (function initSlotEditorObserver() {
    const panel = document.getElementById('wb-panel');
    if (!panel) return;

    const sync = () => {
      const on = DEBUG_SLOT_DRAG && panel.classList.contains('open') && _wbPhase2;
      slotEditShow(on);
    };

    const obs = new MutationObserver(sync);
    obs.observe(panel, { attributes: true });
    setInterval(sync, 200);
  })();
})();
