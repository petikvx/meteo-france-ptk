const STYLES = {
  sun: { fill: "#fbbf24", stroke: "#f59e0b" },
  cloud: { fill: "#94a3b8", stroke: "#64748b" },
  rain: { fill: "#4f9cf9", stroke: "#2563eb" },
  snow: { fill: "#e2e8f0", stroke: "#cbd5e1" },
  storm: { fill: "#6366f1", stroke: "#4338ca" },
  fog: { fill: "#cbd5e1", stroke: "#94a3b8" },
};

function base(code, size, inner) {
  return `<svg class="picto" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
}

function sun(cx = 32, cy = 28, r = 14) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 4);
    const y1 = cy + Math.sin(a) * (r + 4);
    const x2 = cx + Math.cos(a) * (r + 9);
    const y2 = cy + Math.sin(a) * (r + 9);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${STYLES.sun.stroke}" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join("");
  return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${STYLES.sun.fill}"/>`;
}

function cloud(x = 14, y = 30, w = 36) {
  return `<path d="M${x} ${y + 12}c0-10 8-16 17-14 5-8 18-8 22 2 8 1 12 9 8 17H${x + 4}c-6 0-10-3-10-5z" fill="${STYLES.cloud.fill}" stroke="${STYLES.cloud.stroke}" stroke-width="1.5"/>`;
}

function rainDrops() {
  return `<line x1="22" y1="46" x2="18" y2="54" stroke="${STYLES.rain.fill}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="32" y1="46" x2="28" y2="54" stroke="${STYLES.rain.fill}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="42" y1="46" x2="38" y2="54" stroke="${STYLES.rain.fill}" stroke-width="2.5" stroke-linecap="round"/>`;
}

function snowFlakes() {
  return `<circle cx="22" cy="50" r="2.5" fill="${STYLES.snow.fill}"/>
    <circle cx="32" cy="48" r="2.5" fill="${STYLES.snow.fill}"/>
    <circle cx="42" cy="51" r="2.5" fill="${STYLES.snow.fill}"/>`;
}

function bolt() {
  return `<path d="M34 18 L26 36 H32 L28 50 L42 30 H35 Z" fill="${STYLES.storm.fill}"/>`;
}

function fogLines() {
  return `<line x1="14" y1="38" x2="50" y2="38" stroke="${STYLES.fog.stroke}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <line x1="18" y1="46" x2="46" y2="46" stroke="${STYLES.fog.stroke}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
}

function moon() {
  return `<path d="M40 18 A16 16 0 1 1 40 46 A12 12 0 1 0 40 18 Z" fill="${STYLES.sun.fill}"/>`;
}

function renderSvg(code, size = 48) {
  const c = (code || "p1j").toLowerCase();
  const isNight = c.endsWith("n");
  const num = parseInt(c.replace(/\D/g, ""), 10) || 1;

  if (num === 1) {
    return base(c, size, isNight ? moon() : sun());
  }
  if (num === 2) {
    return base(c, size, `${sun(44, 22, 10)}${cloud(10, 30, 34)}`);
  }
  if (num === 3) {
    return base(c, size, `${isNight ? moon() : sun(48, 20, 8)}${cloud(8, 28, 36)}`);
  }
  if (num === 4) {
    return base(c, size, cloud(8, 26, 40));
  }
  if (num === 5 || num === 13 || num === 14 || num === 15) {
    return base(c, size, `${cloud(8, 24, 40)}${rainDrops()}`);
  }
  if (num === 6) {
    return base(c, size, `${isNight ? moon() : sun(44, 20, 9)}${cloud(10, 30, 34)}${rainDrops()}`);
  }
  if (num === 7 || num >= 16) {
    return base(c, size, `${cloud(8, 22, 40)}${snowFlakes()}`);
  }
  if (num === 8 || num === 11 || num === 17) {
    return base(c, size, `${cloud(8, 22, 40)}${bolt()}${rainDrops()}`);
  }
  if (num === 9) {
    return base(c, size, fogLines());
  }
  if (num === 10) {
    return base(c, size, `${cloud(8, 22, 40)}${snowFlakes()}${snowFlakes()}`);
  }
  return base(c, size, sun());
}

export function pictoHtml(code, size = 48) {
  return renderSvg(code, size);
}

export function pictoEmoji(code) {
  const c = (code || "p1").toLowerCase();
  const num = parseInt(c.replace(/\D/g, ""), 10) || 1;
  const map = {
    1: c.endsWith("n") ? "🌙" : "☀️",
    2: "🌤", 3: "⛅", 4: "☁️", 5: "🌧", 6: "🌦",
    7: "🌨", 8: "⛈", 9: "🌫", 10: "❄️",
  };
  return map[num] || "🌡";
}