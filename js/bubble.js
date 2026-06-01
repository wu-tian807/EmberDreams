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

    // ─── 头部点击触发 turn（25% 概率）+ 气泡（每次）────────────────
    let firstClick = true;
    document.addEventListener('click', (e) => {
      if (firstClick) {
        firstClick = false;
        unmute();
        return;   // 首次点击仅解除静音，不触发翻身
      }

      // ── 工作台展开状态：点击空白触发收起动画 ───────────────────────
      if (_wbExpanded || _wbClosing) {
        if (!isInWorkbench(e.clientX, e.clientY) && !_wbClosing) {
          _wbClosing = true;   // 触发收起动画，main.js 负责后续
        }
        return;   // 展开/收起期间屏蔽其他交互
      }

      // ── 工作台点击检测（优先级最高）────────────────────────────────
      if (isInWorkbench(e.clientX, e.clientY)) {
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

