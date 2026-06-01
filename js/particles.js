// particles.js — flame canvas init, rect cache, Particle class, arch spawn, pool

    const flameImg  = new Image();
    flameImg.src    = 'flame.png';   // 8×8 点阵素材

    canvas    = document.getElementById('flame-canvas');
    ctx       = canvas.getContext('2d');


    // ── 稳健的 rect 缓存 ────────────────────────────────────────────
    // 用普通对象存储，避免 DOMRect 在某些时机失效

    function snapshotRect() {
      // 优先取当前前台 video 的 rect，若无效则跳过
      const el = front.vid;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        _cachedRect = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }

    function getVideoRect() {
      snapshotRect();
      return _cachedRect;
    }

    // 窗口尺寸变化时刷新
    window.addEventListener('resize', snapshotRect);

    // 视频开始播放时刷新（初始化 + 每次视频切换后）
    document.getElementById('videoA').addEventListener('playing', snapshotRect);
    document.getElementById('videoB').addEventListener('playing', snapshotRect);

    // ── 拱形生成函数 ─────────────────────────────────────────────────
    // 以发射线为底边，向法线方向隆起的半椭圆区域内随机取点
    function archSpawnPoint(r) {
      const rad     = FIRE_ANGLE * Math.PI / 180;
      const lx      = r.left + r.width * FIRE_FX_L;
      const ly      = r.top  + r.height * FIRE_FY;
      const len     = r.width * (FIRE_FX_R - FIRE_FX_L);
      // 线方向
      const dirX    = Math.cos(rad);
      const dirY    = Math.sin(rad);
      // 法线方向（朝拱形内侧，即视觉上方）
      const normX   = Math.sin(rad);    // -sin(35°)
      const normY   = -Math.cos(rad);   // -cos(35°)

      // 沿线随机取 t∈[0,1]
      const t       = Math.random();
      const baseX   = lx + t * len * dirX;
      const baseY   = ly + t * len * dirY;

      // 该位置允许的最大法线偏移（拱形高度，sin曲线，边缘=0，中心=最大）
      const maxPerp = r.width * ARCH_HEIGHT * Math.sin(t * Math.PI);

      // √random 使面积分布更均匀（避免集中在基线附近）
      const perpOff = Math.sqrt(Math.random()) * maxPerp;

      return {
        x: baseX + perpOff * normX,
        y: baseY + perpOff * normY,
        normX, normY
      };
    }

    class Particle {
      constructor() {
        // 安全默认值：rect 无效时粒子不可见，且每帧持续尝试重置
        this.x = -9999; this.y = -9999;
        this.life = 0; this.decay = 0.01;
        this.baseSize = 0; this.vx = 0; this.vy = 0;
        this.dormant = false; this.waitFrames = 0;
        this.reset(true);
      }

      // 真正设置粒子位置/速度/生命——只在 rect 有效时调用
      _spawn(initial = false) {
        const r = getVideoRect();
        if (!r || r.width < 10) { this.life = 0; return; }
        const pt = archSpawnPoint(r);
        this.x = pt.x;
        this.y = pt.y;

        this.life = initial ? Math.random() : 1.0;
        this.dormant = false;

        const normX = pt.normX, normY = pt.normY;
        const ff = furnaceLevel / 100;

        const spdScale = 0.04 + ff * 2.46;
        const outlier  = Math.random() < (0.1 + ff * 0.3);
        const spd = r.height * spdScale * (outlier
          ? 0.00005 + Math.random() * 0.00005
          : 0.000006 + Math.random() * 0.00001);

        const driftScale = ff * ff;
        this.vx = normX * spd - Math.random() * spd * (0.001 + driftScale * 0.05);
        this.vy = normY * spd + (Math.random() - 0.5) * spd * (0.005 + driftScale * 0.08);

        this.decay = (0.0003 + ff * 0.0045) + Math.random() * (0.0002 + ff * 0.002);
        this.baseSize = r.width * (0.006 + Math.random() * 0.005);
      }

      reset(initial = false) {
        if (initial) { this._spawn(true); return; }

        // 出现间隔：指数衰减 — 火力低时等待长，火力高时几乎立即出现
        // MAX_WAIT=300帧≈5s；k=5 → 50火力≈25帧≈0.4s；100火力≈2帧
        const ff = furnaceLevel / 100;
        const wait = Math.round(300 * Math.exp(-5 * ff));
        if (wait <= 1) {
          this._spawn(false);
        } else {
          this.dormant    = true;
          this.waitFrames = wait;
          this.x = -9999; this.y = -9999;
        }
      }

      update() {
        if (this.dormant) {
          if (--this.waitFrames <= 0) this._spawn(false);
          return;
        }
        this.x    += this.vx;
        this.y    += this.vy;
        if (Math.random() < 0.12) this.vx -= Math.random() * 0.002;
        this.life -= this.decay;
        if (this.life <= 0) this.reset();
      }

      draw() {
        if (this.dormant) return;
        // age: 0(新生) → 1(消亡)，life: 1→0
        const age  = 1 - this.life;
        const PEAK = 0.38;   // 峰值时刻（前38%为生长期）

        let sizeRatio, alpha;
        if (age < PEAK) {
          // 生长阶段：由小变大变亮
          const t   = age / PEAK;
          sizeRatio = t;
          alpha     = t * 0.95;
        } else {
          // 消亡阶段：快速变小变暗变透明
          const t   = (age - PEAK) / (1 - PEAK);   // 0→1
          sizeRatio = 1 - t * t;                    // 二次方收缩
          alpha     = (1 - t * t * t) * 0.95;       // 三次方淡出（更快）
        }

        const sz = this.baseSize * Math.max(0, sizeRatio);
        if (sz <= 0.5) return;

        // 颜色：峰值白黄，其余橙红
        const rr = 255;
        const gg = Math.round(100 + 155 * sizeRatio);   // 橙→黄白
        const bb = Math.round(sizeRatio > 0.75 ? 180 * ((sizeRatio - 0.75) / 0.25) : 0);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'lighter';

        if (flameImg.complete && flameImg.naturalWidth > 0) {
          ctx.drawImage(flameImg,
            this.x - sz / 2, this.y - sz,
            sz, sz * 1.4);
        } else {
          const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, Math.max(0.5, sz));
          grad.addColorStop(0, `rgba(${rr},${gg},${bb},1)`);
          grad.addColorStop(1, `rgba(${rr},${gg >> 1},0,0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(this.x, this.y, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 初始化粒子池（按初始 furnaceLevel=50 估算）
    const initCount = Math.max(1, Math.round(Math.pow(0.5, 2.6) * PARTICLE_MAX));
    for (let i = 0; i < initCount; i++) particles.push(new Particle());

