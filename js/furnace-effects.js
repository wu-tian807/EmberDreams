// furnace-effects.js — furnace opening mask (editor + render)

    // ─── 熔炉火焰粒子系统 ────────────────────────────────────────────
    // 火焰口在视频帧中的相对坐标（4K 3840×2160 原图量测）
    // rightSleep 视角: (1615/3840, 557/2160) ≈ (42.1%, 25.8%)
    // leftSleep  视角: (1595/3840, 580/2160) ≈ (41.5%, 26.9%)
    // 两帧差异极小，统一用均值
    // 熔炉燃烧口横向范围（视频帧宽度百分比）

    // ─── 熔炉开口列遮罩编辑器 ───────────────────────────────────────
    const FURNACE_EDITOR   = false; // false=正式遮罩，true=交互编辑
    const N_MASK_COLS      = 11;
    const MASK_MAX_H_RATIO = 0.09;
    const MASK_SHIFT_LEFT  = 0.008;
    const MASK_EXTRA_LEN   = 0.018;
    // 固化列高数据
    const furnaceMaskCols = [0.25, 0.29, 0.36, 0.40, 0.41, 0.42, 0.40, 0.39, 0.34, 0.32, 0.17];

    // 旋转基线参数（与粒子发射线相同，遮罩可额外左平移）
    function _maskBase(r) {
      const rad  = FIRE_ANGLE * Math.PI / 180;
      const shift = r.width * MASK_SHIFT_LEFT;
      const lx   = r.left + r.width  * FIRE_FX_L - shift * Math.cos(rad);
      const ly   = r.top  + r.height * FIRE_FY   - shift * Math.sin(rad);
      const len  = r.width * (FIRE_FX_R - FIRE_FX_L) + r.width * MASK_EXTRA_LEN;
      const colW = len / N_MASK_COLS;
      const maxH = r.height * MASK_MAX_H_RATIO;
      return { rad, lx, ly, len, colW, maxH };
    }

    // 世界坐标 → 基线本地坐标（原点=lx,ly；X轴=基线方向；Y轴=法线向外）
    function _worldToLocal(wx, wy, lx, ly, rad) {
      const dx = wx - lx, dy = wy - ly;
      return {
        lx :  dx * Math.cos(rad) + dy * Math.sin(rad),
        ly : -dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    function drawFurnaceMask(r) {
      const ff = furnaceLevel / 100;
      if (ff >= 0.99) return;

      // 衰减曲线：低火力时迅速变黑，高火力时几乎不影响
      const darkAlpha = Math.pow(1 - ff, 1.1) * 0.95;
      if (darkAlpha < 0.01) return;

      const { rad, lx, ly, colW, maxH } = _maskBase(r);

      // 模糊半径：一列宽度左右，让边缘向外自然扩散
      const blurPx = Math.max(3, Math.round(colW * 1.1));

      ctx.save();
      ctx.filter    = `blur(${blurPx}px)`;
      ctx.translate(lx, ly);
      ctx.rotate(rad);

      // 各列中心点（x, y_top）
      const pts = furnaceMaskCols.map((v, i) => [
        (i + 0.5) * colW,
        -v * maxH,
      ]);

      // 用贝塞尔曲线平滑连接列顶，形成一条流畅的轮廓
      ctx.beginPath();
      ctx.moveTo(-colW * 0.5, colW * 0.3);   // 左下延伸，保证边缘有扩散余量
      ctx.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        const my = (pts[i - 1][1] + pts[i][1]) / 2;
        ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.lineTo(N_MASK_COLS * colW + colW * 0.5, colW * 0.3); // 右下延伸
      ctx.closePath();

      // 渐变策略：全列体铺满不透明，只在顶端 15% 开始淡出，不让黄色从上方漏出
      // 渐变高度 = maxH（超出所有柱子高度上限），clip 由路径本身控制

      // ── 第一层：中性深灰（去黄，全程）──
      const grad = ctx.createLinearGradient(0, 0, 0, -maxH);
      grad.addColorStop(0,    `rgba(22,20,17,${darkAlpha})`);
      grad.addColorStop(0.85, `rgba(22,20,17,${darkAlpha})`);   // 铺满列体
      grad.addColorStop(1,    'rgba(22,20,17,0)');               // 仅顶端淡出
      ctx.fillStyle = grad;
      ctx.fill();

      // ── 第二层：冷灰去饱和（黄→灰）──
      const coldAlpha = darkAlpha * 0.55;
      const grad2 = ctx.createLinearGradient(0, 0, 0, -maxH);
      grad2.addColorStop(0,    `rgba(55,52,48,${coldAlpha})`);
      grad2.addColorStop(0.85, `rgba(55,52,48,${coldAlpha})`);
      grad2.addColorStop(1,    'rgba(55,52,48,0)');
      ctx.fillStyle = grad2;
      ctx.fill();

      // ── 第三层：纯黑（灰→黑，ff<0.55 时介入）──
      const blackPhase = Math.max(0, (0.55 - ff) / 0.55);
      const blackAlpha = Math.pow(blackPhase, 1.5) * 0.92;
      if (blackAlpha > 0.01) {
        const grad3 = ctx.createLinearGradient(0, 0, 0, -maxH);
        grad3.addColorStop(0,    `rgba(4,3,2,${blackAlpha})`);
        grad3.addColorStop(0.85, `rgba(4,3,2,${blackAlpha})`);
        grad3.addColorStop(1,    'rgba(4,3,2,0)');
        ctx.fillStyle = grad3;
        ctx.fill();
      }

      ctx.restore();
    }

    function drawFurnaceMaskEditor(r) {
      const { rad, lx, ly, colW, maxH } = _maskBase(r);

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rad);
      // 现在 X=基线方向，Y 向下；法线方向（向外）是 Y 负方向

      for (let i = 0; i < N_MASK_COLS; i++) {
        const x = i * colW;
        const h = furnaceMaskCols[i] * maxH;

        // 列体（向法线方向 = -Y）
        ctx.globalAlpha = 0.45;
        ctx.fillStyle   = '#ff6000';
        ctx.fillRect(x + 1, -h, colW - 2, h);

        // 顶部把手
        ctx.globalAlpha = 1;
        ctx.fillStyle   = (_maskDragCol === i) ? '#ffff00' : '#00ffff';
        ctx.fillRect(x + 1, -h - 5, colW - 2, 6);
      }

      // 基线
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(colW * N_MASK_COLS, 0);
      ctx.stroke();

      // 左端点把手（绿色圆）
      ctx.globalAlpha = 1;
      ctx.fillStyle   = (_maskDragCol === -2) ? '#ffff00' : '#00ff88';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();

      // 右端点把手（红色圆）
      ctx.fillStyle   = (_maskDragCol === -3) ? '#ffff00' : '#ff4444';
      ctx.beginPath(); ctx.arc(colW * N_MASK_COLS, 0, 7, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // 数据文字（屏幕坐标，基线下方）
      const dataStr = '[' + furnaceMaskCols.map(v => v.toFixed(2)).join(', ') + ']';
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle   = 'rgba(0,0,0,0.65)';
      ctx.fillRect(lx, ly + 8, colW * N_MASK_COLS, 18);
      ctx.fillStyle = '#0ff';
      ctx.font      = `${Math.max(9, Math.round(colW * 1.1))}px "Courier New", monospace`;
      ctx.fillText(dataStr, lx + 2, ly + 22);
      ctx.restore();
    }

    // 鼠标命中：转换到本地坐标判断
    window.addEventListener('mousedown', (e) => {
      if (!FURNACE_EDITOR) return;
      const r = getVideoRect(); if (!r) return;
      const { rad, lx, ly, colW, maxH } = _maskBase(r);
      const local = _worldToLocal(e.clientX, e.clientY, lx, ly, rad);
      const totalLen = colW * N_MASK_COLS;

      // 端点把手优先检测（半径 10px）
      if (Math.hypot(local.lx, local.ly) <= 10) {
        _maskDragCol = -2; e.stopPropagation(); return;
      }
      if (Math.hypot(local.lx - totalLen, local.ly) <= 10) {
        _maskDragCol = -3; e.stopPropagation(); return;
      }

      // 列把手
      for (let i = 0; i < N_MASK_COLS; i++) {
        const cx = i * colW;
        const h  = furnaceMaskCols[i] * maxH;
        if (local.lx >= cx && local.lx < cx + colW &&
            local.ly >= -h - 8 && local.ly <= 4) {
          _maskDragCol = i;
          e.stopPropagation();
          break;
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (_maskDragCol === -1) return;
      const r = getVideoRect(); if (!r) return;
      const { rad, lx, ly, maxH } = _maskBase(r);
      const local = _worldToLocal(e.clientX, e.clientY, lx, ly, rad);

      if (_maskDragCol === -2) {
        // 拖左端点：FIRE_FX_L 跟着变（世界 X 偏移转回比例）
        FIRE_FX_L = Math.max(0.30, Math.min(FIRE_FX_R - 0.01,
          (e.clientX - r.left) / r.width));
      } else if (_maskDragCol === -3) {
        FIRE_FX_R = Math.max(FIRE_FX_L + 0.01, Math.min(0.65,
          (e.clientX - r.left) / r.width));
      } else {
        furnaceMaskCols[_maskDragCol] = Math.max(0, Math.min(1, -local.ly / maxH));
      }
    });

    window.addEventListener('mouseup', () => {
      if (_maskDragCol !== -1) {
        if (_maskDragCol === -2 || _maskDragCol === -3) {
          console.log(`FIRE_FX_L = ${FIRE_FX_L.toFixed(4)},  FIRE_FX_R = ${FIRE_FX_R.toFixed(4)}`);
        } else {
          const arr = furnaceMaskCols.map(v => Math.round(v * 100) / 100);
          console.log('furnaceMaskCols =', JSON.stringify(arr));
        }
        _maskDragCol = -1;
      }
    });
