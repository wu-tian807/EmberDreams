// lighting.js — darkness overlay, furnace glow, torch glow, fire slider

    // ─── 光照 & 火力 ─────────────────────────────────────────────────
    const darknessCanvas = document.getElementById('darkness-canvas');
    const dCtx            = darknessCanvas.getContext('2d');

    // 三点锚定指数映射：furnace 0→-104，50→-64，100→0
    // 解：x=exp(B/2)=64/40=1.6，B=2ln(1.6)，A=104/(e^B-1)，C=-A*e^B
    const _LB = 2 * Math.log(64 / 40);
    const _LA = 104 / (Math.exp(_LB) - 1);
    const _LC = -_LA * Math.exp(_LB);
    function furnaceToLight(fl) {
      return Math.round(_LA * Math.exp(_LB * fl / 100) + _LC);
    }

    // ─── 熔炉火力轴 ──────────────────────────────────────────────────
    const furnaceSlider = document.getElementById('furnace-slider');
    const furnaceValEl  = document.getElementById('furnace-val');

    furnaceSlider.addEventListener('input', () => {
      furnaceLevel = parseInt(furnaceSlider.value, 10);
      furnaceValEl.textContent = furnaceLevel;
      lightLevel = furnaceToLight(furnaceLevel);
      // 实时平滑更新音量（含停止/重启逻辑）
      if (userUnmuted) _setCrackleVol();
    });

    // 初始同步
    // 初始同步：furnace=50 → light=-68
    lightLevel = furnaceToLight(furnaceLevel);

    function drawDarkness(mx, my, level) {
      // 同步 canvas 尺寸
      if (darknessCanvas.width  !== window.innerWidth ||
          darknessCanvas.height !== window.innerHeight) {
        darknessCanvas.width  = window.innerWidth;
        darknessCanvas.height = window.innerHeight;
      }
      const w = darknessCanvas.width, h = darknessCanvas.height;
      dCtx.clearRect(0, 0, w, h);

      if (level < 0) {
        // ── 暗模式：先填满黑色遮罩，再切洞 ──
        const alpha = (-level / 100) * 0.92;   // 最暗 92% 不透明
        dCtx.globalCompositeOperation = 'source-over';
        dCtx.fillStyle = `rgba(0,0,0,${alpha})`;
        dCtx.fillRect(0, 0, w, h);

        // 切洞工具：destination-out 擦除遮罩
        dCtx.globalCompositeOperation = 'destination-out';

        // ① 鼠标火把照明（随距离越暗越大）
        if (mx >= 0) {
          const torchR = 80 + (-level / 100) * 160;  // 80~240px
          const tg = dCtx.createRadialGradient(mx, my, 0, mx, my, torchR);
          tg.addColorStop(0,    'rgba(0,0,0,1)');
          tg.addColorStop(0.45, 'rgba(0,0,0,0.85)');
          tg.addColorStop(0.75, 'rgba(0,0,0,0.3)');
          tg.addColorStop(1,    'rgba(0,0,0,0)');
          dCtx.fillStyle = tg;
          dCtx.beginPath(); dCtx.arc(mx, my, torchR, 0, Math.PI * 2); dCtx.fill();
        }

        // ② 熔炉火光（闪烁光源）—— fire=0 时彻底熄灭
        const r = getVideoRect();
        if (r && furnaceLevel > 0) {
          const t  = performance.now() / 1000;
          // 中低频叠加：慢基波 + 中频扰动，可见但不急促
          const flicker =
            Math.sin(t * 1.8)  * 0.40 +   // 主呼吸波 ~0.55s周期
            Math.sin(t * 4.3)  * 0.30 +   // 次级抖动
            Math.sin(t * 0.7)  * 0.20 +   // 超慢漂移
            Math.sin(t * 7.1)  * 0.10;    // 轻微高频点缀

          // 火力倍率：指数函数，50火力=×1不变，0火力≈×0.3，100火力≈×3.3
          const furnMult = Math.exp(2.4 * (furnaceLevel / 100 - 0.5));
          const baseR    = r.width * (0.06 + (-level / 100) * 0.10) * furnMult;
          const furnaceR = baseR * (1 + flicker * 0.22);  // 半径±22%，清晰可感

          // 中心轻微摇曳
          const fx = r.left + r.width  * ((FIRE_FX_L + FIRE_FX_R) / 2) + Math.sin(t * 1.7) * baseR * 0.05;
          const fy = r.top  + r.height * FIRE_FY                        + Math.sin(t * 1.2) * baseR * 0.03;

          // 渐变内核随闪烁变化
          const peakAlpha = 0.55 + flicker * 0.20;  // 0.35 ~ 0.75
          const fg = dCtx.createRadialGradient(fx, fy, 0, fx, fy, furnaceR);
          fg.addColorStop(0,    `rgba(0,0,0,${Math.min(1, peakAlpha + 0.45)})`);
          fg.addColorStop(0.4,  `rgba(0,0,0,${Math.min(1, peakAlpha)})`);
          fg.addColorStop(0.75, 'rgba(0,0,0,0.15)');
          fg.addColorStop(1,    'rgba(0,0,0,0)');
          dCtx.fillStyle = fg;
          dCtx.beginPath(); dCtx.arc(fx, fy, furnaceR, 0, Math.PI * 2); dCtx.fill();
        }

        dCtx.globalCompositeOperation = 'source-over';

      } else if (level > 0) {
        // ── 亮模式：叠加暖白光覆盖 ──
        const brightness = (level / 100) * 0.30;
        dCtx.globalCompositeOperation = 'source-over';
        dCtx.fillStyle = `rgba(255, 230, 180, ${brightness})`;
        dCtx.fillRect(0, 0, w, h);
      }
      // level === 0：clearRect 已清空，无操作
    }

    // ─── 鼠标位置追踪（mouseX/mouseY 声明在 shared.js）────────────
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX; mouseY = e.clientY;

      // 拖动角点（编辑器模式）
      if (DEBUG_WB_DRAG && _wbDragIdx >= 0 && _wbFreeCorners) {
        const r = getVideoRect();
        if (r) {
          _wbFreeCorners[_wbDragIdx] = [
            (e.clientX - r.left) / r.width,
            (e.clientY - r.top)  / r.height,
          ];
        }
        document.body.style.cursor = 'grabbing';
        return; // 拖动时不做 hover 检测
      }

      _wbHovered = isInWorkbench(mouseX, mouseY);
      document.body.style.cursor = _wbHovered ? 'pointer' : 'crosshair';
    });

    window.addEventListener('mousedown', (e) => {
      if (!DEBUG_WB_DRAG || !_wbFreeCorners) return;
      const r = getVideoRect(); if (!r) return;
      for (let i = 0; i < 4; i++) {
        const [vx, vy] = _wbFreeCorners[i];
        const sx = r.left + vx * r.width;
        const sy = r.top  + vy * r.height;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 16) {
          _wbDragIdx = i;
          e.preventDefault();
          return;
        }
      }
    });

    window.addEventListener('mouseup', () => { _wbDragIdx = -1; });

    window.addEventListener('mouseleave', () => {
      mouseX = -999; mouseY = -999;
      _wbHovered = false;
      _wbDragIdx = -1;
      document.body.style.cursor = 'crosshair';
    });

