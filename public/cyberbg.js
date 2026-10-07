/* fundo cyber do painel: grade em perspectiva, feixe de varredura e rede de partículas */
(() => {
  const root = document.createElement("div");
  root.id = "cyber";
  root.innerHTML = '<div class="grid"></div><canvas></canvas><div class="scan"></div><div class="beam"></div><div class="vig"></div>';
  document.body.prepend(root);
  const cv = root.querySelector("canvas"), g = cv.getContext("2d");
  if (!g) return;
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, pts = [];
  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; g.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round(Math.min(70, w * h / 24000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h * .75, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25 }));
  }
  function tick() {
    g.clearRect(0, 0, w, h);
    for (const p of pts) {
      if (!still) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h * .75) p.vy *= -1; }
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 150) { g.strokeStyle = `rgba(60,150,255,${(1 - d / 150) * .28})`; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    }
    for (const p of pts) { g.fillStyle = "rgba(90,190,255,.75)"; g.shadowColor = "#2f8bff"; g.shadowBlur = 8; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, 6.283); g.fill(); }
    g.shadowBlur = 0;
    if (!still) requestAnimationFrame(tick);
  }
  size(); tick(); addEventListener("resize", () => { size(); if (still) tick(); });
})();
