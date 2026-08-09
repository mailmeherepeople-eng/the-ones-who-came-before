// P1 — The Erosion Window (design doc: "get this one perfect first").
// A 2.5D soil-column cutaway: the player's own pot and basket side by side,
// and the elder's grave. Redraws as a function of elapsed years while the
// player scrubs the dial. The basket rots; the pot chips but persists.
import { S } from '../strings.js';

export class ErosionPanel {
  constructor(uiRoot, { potRecord, burialRecord }) {
    this.el = document.createElement('div');
    this.el.id = 'erosion-panel';
    this.el.className = 'panel-skin';
    // Docked to the top-right corner at reduced size (inline overrides the
    // stylesheet's centred position). Centred, it permanently covered the
    // diorama middle — including the very mound the caption tells the player
    // to watch while scrubbing.
    this.el.style.cssText = 'left:auto;right:12px;top:58px;transform:none;padding:10px;'; // below the satchel chip (top:10px right:10px)
    this.el.innerHTML = `
      <canvas width="340" height="240" style="width:min(34vw,238px)"></canvas>
      <div id="erosion-caption" class="ero-cap" style="max-width:238px"></div>`;
    uiRoot.appendChild(this.el);
    this.cv = this.el.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.cap = this.el.querySelector('#erosion-caption');
    this.profile = potRecord?.data?.profile ?? [0.34, 0.52, 0.64, 0.66, 0.6, 0.46, 0.34, 0.4];
    this.hasBurial = !!burialRecord;
    // deterministic chip pattern
    this.chips = [];
    for (let i = 0; i < 9; i++) {
      this.chips.push({ side: i % 2 ? 1 : -1, h: (i * 37 % 100) / 100, size: 2 + (i * 53 % 4) });
    }
    this.draw(0);
  }

  // years = elapsed years since burial (0 .. ~7500)
  draw(years) {
    const c = this.ctx;
    const W = 340, H = 240;
    const d = Math.max(0, Math.min(1, years / 6500)); // master decay 0..1
    c.clearRect(0, 0, W, H);

    // sky strip + surface line sinks as soil accumulates
    const surfaceY = 46 + d * 26;
    c.fillStyle = '#8fb8d8';
    c.fillRect(0, 0, W, surfaceY);
    // hut silhouette decays away
    if (d < 0.35) {
      const a = 1 - d / 0.35;
      c.fillStyle = `rgba(109,80,40,${a})`;
      c.fillRect(60, surfaceY - 34 * a, 70, 34 * a);
      c.beginPath();
      c.moveTo(50, surfaceY - 30 * a);
      c.lineTo(95, surfaceY - 52 * a);
      c.lineTo(140, surfaceY - 30 * a);
      c.closePath();
      c.fillStyle = `rgba(201,168,102,${a})`;
      c.fill();
    } else {
      // the mound: a defined dome silhouette with soil banding and a grass
      // cap — not a green blob. Grows as centuries of soil build up.
      const mR = 70, mH = 14 + (d - 0.35) * 14;
      c.save();
      c.beginPath();
      c.ellipse(95, surfaceY + 1, mR, mH, 0, Math.PI, 0);
      c.closePath();
      c.clip();
      c.fillStyle = '#8a6f42'; // packed-earth body
      c.fillRect(95 - mR, surfaceY - mH - 2, mR * 2, mH + 4);
      // soil banding inside the dome — collapsed layers, oldest lowest
      c.strokeStyle = 'rgba(74,55,30,0.55)';
      c.lineWidth = 2;
      for (let b = 1; b <= 3; b++) {
        c.beginPath();
        c.ellipse(95, surfaceY + 1, mR * (1 - b * 0.08), mH * (1 - b * 0.27), 0, Math.PI, 0);
        c.stroke();
      }
      c.restore();
      // grass cap: crisp green crest with a few tufts
      c.strokeStyle = '#6da24e';
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(95, surfaceY + 1, mR, mH, 0, Math.PI, 0);
      c.stroke();
      c.strokeStyle = '#7cb45a';
      c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + ((i + 0.5) / 9) * Math.PI;
        const tx = 95 + Math.cos(ang) * mR * 0.94;
        const ty = surfaceY + 1 + Math.sin(ang) * mH * 0.94;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(tx, ty - 4);
        c.stroke();
      }
    }

    // soil layers
    const layers = ['#7a5b33', '#71532e', '#65482a', '#584026', '#4c3a26'];
    layers.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, surfaceY + i * ((H - surfaceY) / layers.length), W, (H - surfaceY) / layers.length + 1);
    });

    // ---- the pot (player's silhouette), chipping but persisting ----
    const potX = 95, potY = surfaceY + 60, potH = 56, potW = 46;
    c.save();
    c.beginPath();
    const prof = this.profile;
    for (let i = prof.length - 1; i >= 0; i--) {
      const y = potY + potH / 2 - (i / (prof.length - 1)) * potH;
      const x = potX - prof[i] * potW;
      if (i === prof.length - 1) c.moveTo(x, y); else c.lineTo(x, y);
    }
    for (let i = 0; i < prof.length; i++) {
      const y = potY + potH / 2 - (i / (prof.length - 1)) * potH;
      c.lineTo(potX + prof[i] * potW, y);
    }
    c.closePath();
    c.fillStyle = '#b4633e';
    c.fill();
    c.strokeStyle = '#7c3f26'; // outline: the pot must read as a pot at a glance
    c.lineWidth = 2;
    c.stroke();
    // chips appear with decay
    c.globalCompositeOperation = 'destination-out';
    const nChips = Math.floor(d * this.chips.length);
    for (let i = 0; i < nChips; i++) {
      const ch = this.chips[i];
      const y = potY + potH / 2 - ch.h * potH;
      const x = potX + ch.side * prof[Math.floor(ch.h * (prof.length - 1))] * potW;
      c.beginPath();
      c.arc(x, y, ch.size, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // ---- the basket: darkens, frays, vanishes ----
    const bX = 175, bY = potY;
    const bAlpha = Math.max(0, 1 - d / 0.3); // gone by ~2,000 years
    if (bAlpha > 0.01) {
      c.save();
      c.globalAlpha = bAlpha;
      const darken = 1 - d / 0.3;
      c.fillStyle = `rgb(${Math.round(120 + 81 * darken)},${Math.round(90 + 78 * darken)},${Math.round(60 + 42 * darken)})`;
      const fray = 1 - 0.35 * (d / 0.3);
      c.beginPath();
      c.moveTo(bX - 20 * fray, bY - 26 * fray);
      c.lineTo(bX + 20 * fray, bY - 26 * fray);
      c.lineTo(bX + 14 * fray, bY + 26 * fray);
      c.lineTo(bX - 14 * fray, bY + 26 * fray);
      c.closePath();
      c.fill();
      // weave: horizontal wefts crossed by vertical warps — reads as basketry
      c.strokeStyle = 'rgba(60,44,26,0.6)';
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(bX - 18 * fray, bY + i * 9 * fray);
        c.lineTo(bX + 18 * fray, bY + i * 9 * fray);
        c.stroke();
      }
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(bX + i * 11 * fray, bY - 24 * fray);
        c.lineTo(bX + i * 10 * fray, bY + 24 * fray);
        c.stroke();
      }
      c.restore();
    } else {
      // "empty layer": a hatched void where the basket sat — organic = gone.
      // (Was a dashed rectangle that read as a placeholder, not as absence.)
      c.save();
      c.beginPath();
      c.rect(bX - 18, bY - 24, 36, 48);
      c.clip();
      c.strokeStyle = 'rgba(240,230,207,0.22)';
      c.lineWidth = 1.5;
      for (let i = -4; i <= 5; i++) {
        c.beginPath();
        c.moveTo(bX - 26 + i * 9, bY + 30);
        c.lineTo(bX + 2 + i * 9, bY - 30);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = 'rgba(240,230,207,0.35)';
      c.lineWidth = 1.5;
      c.strokeRect(bX - 18, bY - 24, 36, 48);
    }

    // ---- the grave ----
    if (this.hasBurial) {
      const gX = 272, gY = surfaceY + 88;
      // body → bones
      const bodyA = Math.max(0, 1 - d / 0.22);
      if (bodyA > 0.01) {
        c.fillStyle = `rgba(154,116,72,${bodyA})`;
        c.fillRect(gX - 26, gY - 6, 52, 12);
        c.beginPath(); c.arc(gX - 30, gY, 7, 0, Math.PI * 2); c.fill();
      }
      // bones persist — a readable skeleton pictogram, not specks
      c.strokeStyle = '#e8e0cc';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(gX - 22, gY); c.lineTo(gX + 20, gY); c.stroke(); // spine
      c.fillStyle = '#e8e0cc';
      c.beginPath(); c.arc(gX - 29, gY, 6.5, 0, Math.PI * 2); c.fill(); // skull
      c.fillStyle = '#4c3a26';
      c.beginPath(); c.arc(gX - 31, gY - 1.5, 1.8, 0, Math.PI * 2); c.fill(); // eye socket
      c.strokeStyle = '#e8e0cc';
      c.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { // ribs
        c.beginPath();
        c.moveTo(gX - 15 + i * 9, gY - 7);
        c.lineTo(gX - 15 + i * 9, gY + 7);
        c.stroke();
      }
      // cloth wisp fades fast
      const clothA = Math.max(0, 1 - d / 0.12);
      if (clothA > 0.01) {
        c.fillStyle = `rgba(160,86,60,${clothA})`;
        c.fillRect(gX - 20, gY - 8, 36, 4);
      }
      // beads persist untouched — strung, so they read as a necklace
      c.strokeStyle = 'rgba(242,227,201,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(gX - 15, gY + 11);
      c.quadraticCurveTo(gX, gY + 16, gX + 15, gY + 11);
      c.stroke();
      c.fillStyle = '#f2e3c9';
      for (let i = 0; i < 6; i++) {
        const bt = i / 5;
        const px = gX - 15 + bt * 30;
        const py = gY + 11 + Math.sin(bt * Math.PI) * 3.5;
        c.beginPath(); c.arc(px, py, 3, 0, Math.PI * 2); c.fill();
      }
      // stone blade: a tanged point, not a grey stub
      c.fillStyle = '#8d8d8d';
      c.beginPath();
      c.moveTo(gX + 24, gY + 2); // tip
      c.lineTo(gX + 30, gY + 18);
      c.lineTo(gX + 19, gY + 18);
      c.closePath();
      c.fill();
      c.fillStyle = '#6f6f6f';
      c.fillRect(gX + 23, gY + 18, 3, 4); // tang
    }

    // item labels: drawn 2-colour pictograms ≥12px (10px emoji rendered as
    // unreadable specks on low-DPI panels)
    const labY = potY + potH / 2 + 8;
    drawPotIcon(c, potX, labY);
    drawBasketIcon(c, bX, labY);
    if (this.hasBurial) drawBoneIcon(c, 272, labY);
  }

  setCaption(text) { this.cap.textContent = text; }

  dispose() { this.el.remove(); }
}

// ---------- pictogram labels (simple 2-colour shapes, ≥12px) ----------
function drawPotIcon(c, x, y) {
  c.fillStyle = '#c9744c';
  c.beginPath();
  c.moveTo(x - 4, y + 2);
  c.bezierCurveTo(x - 10, y + 5, x - 9, y + 14, x, y + 14);
  c.bezierCurveTo(x + 9, y + 14, x + 10, y + 5, x + 4, y + 2);
  c.closePath();
  c.fill();
  c.fillStyle = '#7c3f26';
  c.fillRect(x - 4, y, 8, 3); // rim
}

function drawBasketIcon(c, x, y) {
  c.fillStyle = '#c9a86a';
  c.beginPath();
  c.moveTo(x - 8, y + 2);
  c.lineTo(x + 8, y + 2);
  c.lineTo(x + 6, y + 14);
  c.lineTo(x - 6, y + 14);
  c.closePath();
  c.fill();
  c.strokeStyle = '#7a5b33';
  c.lineWidth = 1;
  for (let i = 0; i < 3; i++) { // wefts
    c.beginPath();
    c.moveTo(x - 8 + i, y + 5 + i * 3.5);
    c.lineTo(x + 8 - i, y + 5 + i * 3.5);
    c.stroke();
  }
  for (const wx of [-3, 3]) { // warps
    c.beginPath();
    c.moveTo(x + wx, y + 2);
    c.lineTo(x + wx, y + 14);
    c.stroke();
  }
}

function drawBoneIcon(c, x, y) {
  c.fillStyle = '#e8e0cc';
  c.fillRect(x - 6, y + 6, 12, 3.5);
  for (const [dx, dy] of [[-6, 5], [-6, 10], [6, 5], [6, 10]]) {
    c.beginPath();
    c.arc(x + dx, y + dy, 2.8, 0, Math.PI * 2);
    c.fill();
  }
}

export const EROSION_STRINGS = S.act2;
