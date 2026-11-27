import { useEffect, useRef, useState } from 'react';

const BOX = 260; // the square the person crops in, in screen pixels

/** Move and zoom a picture inside a circle, then keep what is inside it. Nothing is stored here: the result goes to onDone. */
export function CropPicture({ img, url, onDone, onCancel }: {
  img: HTMLImageElement;
  url: string;
  onDone: (sx: number, sy: number, size: number) => void;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // image centre, from the middle of the box
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const base = BOX / Math.min(img.width, img.height); // zoom 1 = the short side exactly fills the box
  const s = base * zoom;
  const dw = img.width * s;
  const dh = img.height * s;

  // keep the picture covering the whole box
  const clamp = (p: { x: number; y: number }, w = dw, h = dh) => ({
    x: Math.max(-(w - BOX) / 2, Math.min((w - BOX) / 2, p.x)),
    y: Math.max(-(h - BOX) / 2, Math.min((h - BOX) / 2, p.y)),
  });
  const shown = clamp(pan);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onCancel]);

  const setZ = (z: number) => {
    const ns = base * z;
    setZoom(z);
    setPan((p) => clamp(p, img.width * ns, img.height * ns));
  };

  const save = () => {
    const size = BOX / s;
    onDone(img.width / 2 - (BOX / 2 + shown.x) / s, img.height / 2 - (BOX / 2 + shown.y) / s, size);
  };

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="crop-title">Crop your picture</h3>
        <p className="muted">Drag to move the picture, and use the slider to zoom.</p>
        <div
          className="crop-box"
          style={{ width: BOX, height: BOX }}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: shown.x, py: shown.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPan(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <img src={url} alt="" draggable={false} style={{ width: dw, height: dh, left: BOX / 2 + shown.x - dw / 2, top: BOX / 2 + shown.y - dh / 2 }} />
          <span className="crop-ring" aria-hidden />
        </div>
        <label className="crop-zoom">Zoom
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} aria-label="Zoom" />
        </label>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={save}>Save picture</button>
        </div>
      </div>
    </div>
  );
}
