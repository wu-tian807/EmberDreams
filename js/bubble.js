// bubble.js — speech bubble, head/workbench click handlers

    // ─── 睡梦气泡 ───────────────────────────────────────────────────
    const BUBBLE_TEXTS = [
      '...', 'zzz', 'z z z', 'zZz',
      'hmm...', 'nnn...', 'mhh~', 'shh...',
      'huh...?', 'zzz~', '*yawn*', 'mm...',
      'nooo...', '...zz', 'sleepy~',
    ];
    const bubbleEl   = document.getElementById('speech-bubble');
    const bubbleText = document.getElementById('bubble-text');
    let   bubbleTimer = null;

    function showBubble() {
      const r = getVideoRect();
      if (!r) return;

      // 气泡显示在头部的右上方
      const size = r.width * 0.11;   // 缩小 45%（0.20 * 0.55 ≈ 0.11）
      const cx   = r.left + r.width  * HEAD_CX;
      const cy   = r.top  + r.height * HEAD_CY;

      bubbleEl.style.width  = size + 'px';
      bubbleEl.style.height = size + 'px';
      bubbleEl.style.left   = (cx + size * 0.3) + 'px';   // 稍微左移
      bubbleEl.style.top    = (cy - size * 1.35) + 'px';  // 上移

      // 字体大小随气泡缩放
      bubbleText.style.fontSize = (size * 0.14) + 'px';
      bubbleText.textContent = BUBBLE_TEXTS[Math.floor(Math.random() * BUBBLE_TEXTS.length)];
      bubbleText.classList.remove('fire-blind');

      // 重置动画
      bubbleEl.classList.remove('hide', 'show');
      void bubbleEl.offsetHeight;
      bubbleEl.classList.add('show');

      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => {
        bubbleEl.classList.replace('show', 'hide');
        bubbleTimer = setTimeout(() => bubbleEl.classList.remove('hide'), 600);
      }, 1800);
    }

    // ─── 烈焰彩蛋：furnaceLevel > 80 且 sleepLeft 时弹出刺眼台词 ────
    const FIRE_BLIND_TEXTS = [
      'Ugh... too bright!',
      'So bright...!',
      '...my eyes!',
      'Ugh, so bright!',
      'Argh... bright!',
    ];

    // 显示彩蛋气泡，onDone 在气泡开始消退时（~2s后）调用
    function showFireBlindBubble(onDone) {
      const r = getVideoRect();
      if (!r) return;

      const size = r.width * 0.145;
      const cx   = r.left + r.width  * HEAD_CX;
      const cy   = r.top  + r.height * HEAD_CY;

      bubbleEl.style.width  = size + 'px';
      bubbleEl.style.height = size + 'px';
      bubbleEl.style.left   = (cx + size * 0.3) + 'px';
      bubbleEl.style.top    = (cy - size * 1.4) + 'px';

      bubbleText.style.fontSize = (size * 0.115) + 'px';
      bubbleText.textContent =
        FIRE_BLIND_TEXTS[Math.floor(Math.random() * FIRE_BLIND_TEXTS.length)];
      bubbleText.classList.add('fire-blind');

      bubbleEl.classList.remove('hide', 'show');
      void bubbleEl.offsetHeight;
      bubbleEl.classList.add('show');

      clearTimeout(bubbleTimer);
      // 2s 后开始消退，同时触发翻身
      bubbleTimer = setTimeout(() => {
        bubbleEl.classList.replace('show', 'hide');
        if (onDone) onDone();
        bubbleTimer = setTimeout(() => bubbleEl.classList.remove('hide'), 700);
      }, 2000);
    }
    window.showFireBlindBubble = showFireBlindBubble;

    // ─── 头部点击触发 turn（25% 概率）+ 气泡（每次）────────────────
    let firstClick = true;
    document.addEventListener('click', (e) => {
      if (firstClick) {
        firstClick = false;
        unmute();
        return;   // 首次点击仅解除静音，不触发翻身
      }

      // ── title 悬浮图点击：暂停 / 继续（不展开面板）────────────────
      const titleEl = document.getElementById('wb-title');
      // wrapper 是 div，点击可能命中内部 img，用 closest 统一处理
      const onTitle = !!(titleEl && e.target.closest('#wb-title') === titleEl);
      if (onTitle && !_wbExpanded && !_wbClosing) {
        if (typeof mpTogglePause === 'function') mpTogglePause();
        return;
      }

      // ── 工作台展开状态：点击空白触发收起动画 ───────────────────────
      // data-wb-ui 标记的元素（title / panel 及其所有子元素）点击均不收起
      if (_wbExpanded || _wbClosing) {
        const onUI = !!e.target.closest('[data-wb-ui]');
        if (!isInWorkbench(e.clientX, e.clientY) && !onUI && !_wbClosing) {
          _wbClosing = true;
        }
        return;
      }

      // ── 工作台点击检测（优先级最高）────────────────────────────────
      // 直接命中 title 元素时不展开（已在上面处理）
      if (isInWorkbench(e.clientX, e.clientY) && !onTitle) {
        onWorkbenchClick(e);
        return;
      }

      if (state === 'turning') return;

      const r = getVideoRect();
      if (!r) return;

      const hx   = r.left + r.width  * HEAD_CX;
      const hy   = r.top  + r.height * HEAD_CY;
      const hr   = r.width * HEAD_R;
      const dist = Math.hypot(e.clientX - hx, e.clientY - hy);

      if (dist <= hr) {
        showBubble();                        // 每次点击头部都弹气泡
        if (Math.random() < 0.25) turn();   // 25% 触发翻身
      }
    });

    // ─── 工作台点击回调 ──────────────────────────────────────────────
    function onWorkbenchClick(e) {
      _wbExpanded = true;
    }

    turnBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!userUnmuted) unmute();
      turn();
    });

