function formatLabel(timestamp, timezone, range) {
  const date = new Date(timestamp * 1000);
  if (range === 48) {
    return date.toLocaleString("fr-FR", {
      weekday: "short",
      hour: "2-digit",
      timeZone: timezone,
    });
  }
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function renderCharts(container, hours, timezone, range = 24) {
  if (!hours.length) {
    container.innerHTML = "";
    return;
  }

  const slice = hours.slice(0, range);
  const temps = slice.map((h) => h.T?.value ?? 0);
  const humidity = slice.map((h) =>
    typeof h.humidity === "object" ? h.humidity?.value ?? 0 : h.humidity ?? 0
  );
  const labels = slice.map((h) => formatLabel(h.dt, timezone, range));

  container.innerHTML = `
    <div class="charts-grid">
      <div class="chart-card chart-card--main">
        <h4>Température (${range} h)</h4>
        ${lineChart(temps, labels, "#f97316", "°C", range, { height: 260 })}
      </div>
      <div class="chart-card">
        <h4>Humidité (${range} h)</h4>
        ${lineChart(humidity, labels, "#4f9cf9", "%", range, { height: 200 })}
      </div>
    </div>`;
}

function lineChart(values, labels, color, unit, range, { height = 200 } = {}) {
  const w = 1000;
  const h = height;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const chartRange = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = pad.top + innerH - ((v - min) / chartRange) * innerH;
    return { x, y, v };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L${points[points.length - 1].x},${pad.top + innerH} L${points[0].x},${pad.top + innerH} Z`;

  const yTicks = [min, (min + max) / 2, max].map((v) => {
    const y = pad.top + innerH - ((v - min) / chartRange) * innerH;
    return `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" class="chart-tick">${Math.round(v)}${unit}</text>
      <line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" class="chart-grid"/>`;
  });

  const tickCount = range === 48 ? 8 : 6;
  const xStep = Math.max(1, Math.floor(labels.length / tickCount));
  const xTicks = labels
    .map((label, i) => ({ label, i }))
    .filter((_, i) => i % xStep === 0 || i === labels.length - 1)
    .map(({ label, i }) => {
      const x = pad.left + (i / Math.max(labels.length - 1, 1)) * innerW;
      return `<text x="${x}" y="${h - 6}" text-anchor="middle" class="chart-tick">${label}</text>`;
    });

  const dots = points
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" class="chart-dot">
          <title>${Math.round(p.v)}${unit}</title>
        </circle>`
    )
    .join("");

  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
    ${yTicks.join("")}
    <path d="${areaD}" fill="${color}" opacity="0.12"/>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${xTicks.join("")}
  </svg>`;
}