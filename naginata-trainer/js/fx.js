// =============================================================================
// 画面エフェクト(全画面キャンバスのパーティクル)
// =============================================================================
(function () {
  let canvas = null;
  let ctx = null;
  let parts = [];
  let raf = 0;

  function ensure() {
    if (canvas) return true;
    canvas = document.getElementById('fx-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = performance.now();
    parts = parts.filter((p) => now < p.die);
    for (const p of parts) {
      const t = (now - p.born) / 1000;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * p.g * t * t;
      const life = (p.die - now) / (p.die - p.born);
      ctx.globalAlpha = Math.max(life, 0);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.vr * t);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(p.size * life, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (parts.length) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function add(list) {
    parts.push(...list);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // 1点から放射状に飛び散る火花
  function burst(x, y, {
    count = 24,
    colors = ['#4cc2ff', '#5fd68a', '#b48cff'],
    speed = 280,
    life = 750,
    size = 5,
  } = {}) {
    if (!ensure()) return;
    const now = performance.now();
    add(Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      return {
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.35,
        g: 600,
        color: colors[(Math.random() * colors.length) | 0],
        born: now,
        die: now + life * (0.55 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        shape: 'dot',
      };
    }));
  }

  // 画面上部から降る紙吹雪
  function confetti({ count = 150, duration = 2200 } = {}) {
    if (!ensure()) return;
    const now = performance.now();
    const colors = ['#ffd700', '#4cc2ff', '#5fd68a', '#ff8cc0', '#b48cff', '#ffb84c'];
    add(Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 140,
      vy: 130 + Math.random() * 180,
      g: 150,
      color: colors[(Math.random() * colors.length) | 0],
      born: now,
      die: now + duration * (0.7 + Math.random() * 0.6),
      size: 9 + Math.random() * 7,
      shape: 'rect',
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 12,
    })));
  }

  globalThis.Fx = { burst, confetti };
})();
