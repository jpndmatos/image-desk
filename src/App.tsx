import ThemeToggle from './ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Images,
  LoaderCircle,
  Maximize2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { zipSync } from 'fflate';
import {
  bytes,
  fitSize,
  outputName,
  processImage,
  readImage,
  sampleFile,
  type Format,
} from './image';
type Item = {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  result?: { url: string; blob: Blob; width: number; height: number };
  error?: string;
};
const presets = [
  { name: 'Web', width: 1600, height: 1600, note: 'Maximum 1600 px' },
  { name: 'Social', width: 1080, height: 1080, note: 'Fits inside 1080 × 1080' },
  { name: 'Original', width: 20000, height: 20000, note: 'Keep original dimensions' },
];
const formatNames: Record<Format, string> = {
  'image/webp': 'WebP',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
};
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function App() {
  const [items, setItems] = useState<Item[]>([]),
    [format, setFormat] = useState<Format>('image/webp'),
    [quality, setQuality] = useState(82),
    [preset, setPreset] = useState('Web'),
    [width, setWidth] = useState(1600),
    [height, setHeight] = useState(1600),
    [background, setBackground] = useState('#ffffff'),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [compare, setCompare] = useState<string | null>(null),
    [progress, setProgress] = useState(0),
    [showOriginal, setShowOriginal] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    current = useRef<Item[]>([]),
    urls = useRef(new Set<string>()),
    dragDepth = useRef(0),
    preview = useRef<HTMLDialogElement>(null);
  current.current = items;
  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const revoke = (url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  };
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (compare) {
      preview.current?.showModal();
      setShowOriginal(false);
    }
  }, [compare]);
  function invalidate() {
    setItems((old) =>
      old.map((item) => {
        if (item.result) revoke(item.result.url);
        return { ...item, result: undefined, error: undefined };
      }),
    );
  }
  async function addFiles(files: File[]) {
    if (busy || adding) return;
    setAdding(true);
    setError('');
    const accepted: Item[] = [];
    const problems: string[] = [];
    for (const file of files) {
      if (current.current.length + accepted.length >= 20) {
        problems.push('Keep each batch to 20 images.');
        break;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        problems.push(`${file.name}: use JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > 30 * 1024 * 1024) {
        problems.push(`${file.name}: the limit is 30 MB.`);
        continue;
      }
      const url = makeUrl(file);
      try {
        const img = await readImage(url);
        if (img.naturalWidth * img.naturalHeight > 40000000)
          throw new Error('The limit is 40 megapixels.');
        accepted.push({
          id: crypto.randomUUID(),
          file,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      } catch (e) {
        revoke(url);
        problems.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setItems((old) => [...old, ...accepted]);
    setAdding(false);
    if (problems.length) setError(problems.join(' '));
    if (accepted.length)
      setNotice(`${accepted.length} image${accepted.length === 1 ? '' : 's'} added. `);
  }
  async function convert() {
    if (busy || adding || !items.length) return;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 20000 ||
      height > 20000
    ) {
      setError('Use whole dimensions between 1 and 20,000 pixels.');
      return;
    }
    setBusy(true);
    setError('');
    setProgress(0);
    let succeeded = 0;
    for (const item of items) {
      try {
        const result = await processImage(
          item.url,
          format,
          quality / 100,
          width,
          height,
          background,
        );
        const url = makeUrl(result.blob);
        if (item.result) revoke(item.result.url);
        setItems((old) =>
          old.map((x) =>
            x.id === item.id ? { ...x, result: { ...result, url }, error: undefined } : x,
          ),
        );
        succeeded++;
      } catch (e) {
        setItems((old) =>
          old.map((x) => (x.id === item.id ? { ...x, error: (e as Error).message } : x)),
        );
      }
      setProgress((p) => p + 1);
      await new Promise((r) => setTimeout(r, 0));
    }
    setBusy(false);
    setNotice(`${succeeded} of ${items.length} images processed.`);
  }
  function remove(id: string) {
    setItems((old) =>
      old.filter((item) => {
        if (item.id !== id) return true;
        revoke(item.url);
        if (item.result) revoke(item.result.url);
        return false;
      }),
    );
  }
  async function downloadAll() {
    const ready = items.filter((x) => x.result);
    try {
      const entries: Record<string, Uint8Array> = {};
      for (let i = 0; i < ready.length; i++) {
        const item = ready[i];
        entries[
          `${String(i + 1).padStart(2, '0')}-${outputName(item.file.name, item.result!.blob.type)}`
        ] = new Uint8Array(await item.result!.blob.arrayBuffer());
      }
      download(
        new Blob([zipSync(entries, { level: 0 }).buffer as ArrayBuffer], {
          type: 'application/zip',
        }),
        'image-desk.zip',
      );
      setNotice('ZIP downloaded.');
    } catch {
      setError('Could not create the ZIP. You can still download images individually.');
    }
  }
  const ready = items.filter((x) => x.result),
    originalBytes = ready.reduce((n, x) => n + x.file.size, 0),
    outputBytes = ready.reduce((n, x) => n + x.result!.blob.size, 0),
    saved = originalBytes - outputBytes;
  const active = items.find((x) => x.id === compare);
  const disabled = busy || adding;
  return (
    <>
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <a className="brand" href="./">
          Image Desk
        </a>
        <span className="header-purpose">Image converter</span>
        <ThemeToggle />
      </header>
      <main>
        <div className="intro">
          <div>
            <h1>Convert images</h1>
            <p>Resize and export JPEG, PNG, and WebP files.</p>
          </div>
          <p className="privacy-note">Files are processed on this device.</p>
        </div>
        <div id="workspace" className="workspace">
          <section
            className={'desk ' + (dragging ? 'dragging' : '')}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current++;
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (--dragDepth.current === 0) setDragging(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              void addFiles(Array.from(e.dataTransfer.files));
            }}
            aria-label="Image workspace"
          >
            <div className="desk-toolbar">
              <div>
                <Images size={16} />
                <h2>Files</h2>
                <span className="count">{items.length}</span>
              </div>
              <div className="queue-actions">
                {items.length > 0 && (
                  <button
                    className="button"
                    disabled={disabled || items.length >= 20}
                    onClick={() => input.current?.click()}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add files
                  </button>
                )}
                <button
                  className="text-button"
                  disabled={disabled || !items.length}
                  onClick={() => {
                    for (const item of items) {
                      revoke(item.url);
                      if (item.result) revoke(item.result.url);
                    }
                    setItems([]);
                  }}
                >
                  <RotateCcw size={13} />
                  Clear all
                </button>
              </div>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />
            {items.length === 0 ? (
              <div className="dropzone">
                <Upload size={28} className="upload-symbol" aria-hidden="true" />
                <h2>Add images</h2>
                <p>Drag files here or choose them from your device.</p>
                <button
                  className="button primary"
                  disabled={disabled}
                  onClick={() => input.current?.click()}
                >
                  <Upload size={15} />
                  Choose images
                </button>
                <span className="file-hint">JPEG, PNG & WebP / Up to 20 images / 30 MB each</span>
                <div className="sample-line">
                  <button
                    disabled={disabled}
                    onClick={async () => {
                      try {
                        await addFiles([await sampleFile()]);
                      } catch {
                        setError('Could not create the sample. Try choosing an image.');
                      }
                    }}
                  >
                    Load sample <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="image-grid">
                {items.map((item) => {
                  let target;
                  try {
                    target = fitSize(item.width, item.height, width, height);
                  } catch {
                    target = { width: item.width, height: item.height };
                  }
                  const saving = item.result
                    ? Math.round((1 - item.result.blob.size / item.file.size) * 100)
                    : 0;
                  return (
                    <article className="image-card" key={item.id}>
                      <div className="image-preview">
                        <img src={item.result?.url || item.url} alt={item.file.name} />
                        <button
                          className="preview-button"
                          onClick={() => setCompare(item.id)}
                          aria-label={'Preview ' + item.file.name}
                        >
                          <Maximize2 size={15} />
                        </button>
                        <button
                          className="remove-button"
                          disabled={disabled}
                          onClick={() => remove(item.id)}
                          aria-label={'Remove ' + item.file.name}
                        >
                          <X size={14} />
                        </button>
                        {item.result && (
                          <span className={'savings ' + (saving < 0 ? 'larger' : '')}>
                            {saving >= 0 ? '−' + saving + '%' : 'Larger file'}
                          </span>
                        )}
                      </div>
                      <div className="image-details">
                        <h3 title={item.file.name}>{item.file.name}</h3>
                        <p>
                          {item.width} × {item.height}
                          <ChevronRight size={11} />
                          {item.result
                            ? `${item.result.width} × ${item.result.height}`
                            : `${target.width} × ${target.height}`}
                        </p>
                        <div className="image-bottom">
                          <span>
                            {bytes(item.file.size)}
                            {item.result && (
                              <>
                                <ArrowRight size={11} />
                                <strong>{bytes(item.result.blob.size)}</strong>
                              </>
                            )}
                          </span>
                          {item.result ? (
                            <button
                              className="icon-button"
                              aria-label={'Download ' + item.file.name}
                              onClick={() =>
                                download(
                                  item.result!.blob,
                                  outputName(item.file.name, item.result!.blob.type),
                                )
                              }
                            >
                              <Download size={17} />
                            </button>
                          ) : (
                            <span className="status-label">
                              {busy ? 'Working…' : 'Ready to process'}
                            </span>
                          )}
                        </div>
                        {item.error && <p className="card-error">{item.error}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {dragging && (
              <div className="drag-overlay">
                <Upload size={35} />
                <strong>Drop images here</strong>
                <span>JPEG, PNG, or WebP</span>
              </div>
            )}
          </section>
          <aside className="settings">
            <div className="panel-heading">
              <SlidersHorizontal size={16} />
              <h2>Export settings</h2>
            </div>
            <fieldset disabled={disabled}>
              <legend className="step-label">Preset</legend>
              <div className="presets">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className={preset === p.name ? 'active' : ''}
                    aria-pressed={preset === p.name}
                    onClick={() => {
                      invalidate();
                      setPreset(p.name);
                      setWidth(p.width);
                      setHeight(p.height);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="hint">
                {presets.find((p) => p.name === preset)?.note || 'Custom dimensions'}
              </p>
            </fieldset>
            <fieldset disabled={disabled}>
              <legend className="step-label">Format</legend>
              <div className="format-options">
                {(['image/webp', 'image/jpeg', 'image/png'] as Format[]).map((f) => (
                  <label key={f} className={format === f ? 'checked' : ''}>
                    <input
                      type="radio"
                      name="format"
                      checked={format === f}
                      onChange={() => {
                        invalidate();
                        setFormat(f);
                      }}
                    />
                    <span>{formatNames[f]}</span>
                    {f === 'image/webp' && <small>Recommended</small>}
                  </label>
                ))}
              </div>
              <p className="hint">
                {format === 'image/png'
                  ? 'Lossless output. Best for transparency and graphics.'
                  : format === 'image/jpeg'
                    ? 'Lossy format for photographs.'
                    : 'Lossy format with transparency support.'}
              </p>
            </fieldset>
            <fieldset disabled={disabled || format === 'image/png'}>
              <legend className="step-label">
                Quality <strong>{format === 'image/png' ? 'Lossless' : quality + '%'}</strong>
              </legend>
              <input
                aria-label="Image quality"
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(e) => {
                  invalidate();
                  setQuality(Number(e.target.value));
                }}
              />
              <div className="range-labels">
                <span>Smaller file</span>
                <span>More detail</span>
              </div>
              {format === 'image/png' && <p className="hint">PNG doesn’t use a quality setting.</p>}
            </fieldset>
            <fieldset disabled={disabled}>
              <legend className="step-label">Maximum dimensions</legend>
              <div className="dimension-fields">
                <label>
                  Max width
                  <div>
                    <input
                      type="number"
                      min="1"
                      max="20000"
                      value={width}
                      onChange={(e) => {
                        invalidate();
                        setPreset('Custom');
                        setWidth(Number(e.target.value));
                      }}
                    />
                    <span>px</span>
                  </div>
                </label>
                <X size={12} />
                <label>
                  Max height
                  <div>
                    <input
                      type="number"
                      min="1"
                      max="20000"
                      value={height}
                      onChange={(e) => {
                        invalidate();
                        setPreset('Custom');
                        setHeight(Number(e.target.value));
                      }}
                    />
                    <span>px</span>
                  </div>
                </label>
              </div>
              <span className="aspect-note">
                <Check size={12} />
                Preserve aspect ratio. No upscaling.
              </span>
              {format === 'image/jpeg' && (
                <label className="background-field">
                  Transparency background
                  <input
                    type="color"
                    value={background}
                    onChange={(e) => {
                      invalidate();
                      setBackground(e.target.value);
                    }}
                  />
                </label>
              )}
            </fieldset>
          </aside>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error">
              <X size={15} />
            </button>
          </div>
        )}
        {items.length > 0 && (
          <div className="action-bar">
            {busy && (
              <progress
                className="batch-progress"
                aria-label="Batch processing"
                value={progress}
                max={items.length}
              />
            )}
            <div className="batch-summary">
              <div>
                <strong>
                  {ready.length
                    ? `${ready.length} image${ready.length === 1 ? '' : 's'} processed`
                    : items.length
                      ? `${items.length} image${items.length === 1 ? '' : 's'} selected`
                      : 'No images selected'}
                </strong>
                <p>
                  {ready.length
                    ? `${bytes(originalBytes)} → ${bytes(outputBytes)} / ${saved >= 0 ? bytes(saved) + ' saved' : bytes(-saved) + ' larger, try a smaller size or lower quality'}`
                    : items.length
                      ? 'Choose export settings, then process the files.'
                      : 'Add files to start a batch.'}
                </p>
              </div>
            </div>
            <div className="action-buttons">
              {ready.length > 0 && (
                <button
                  className={ready.length === items.length ? 'button primary' : 'button'}
                  disabled={disabled}
                  onClick={() => void downloadAll()}
                >
                  <Download size={16} />
                  Download ZIP
                </button>
              )}
              {ready.length < items.length && (
                <button
                  className="button primary"
                  disabled={disabled || !items.length}
                  onClick={() => void convert()}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}{' '}
                  {busy
                    ? `Processing ${progress}/${items.length}`
                    : adding
                      ? 'Adding images…'
                      : ready.length === items.length && items.length
                        ? 'Process again'
                        : 'Process images'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      <dialog
        ref={preview}
        className="preview-dialog"
        onCancel={() => setCompare(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            preview.current?.close();
            setCompare(null);
          }
        }}
      >
        {active && (
          <>
            <div className="preview-heading">
              <h2>{active.file.name}</h2>
              <button
                className="icon-button"
                aria-label="Close preview"
                onClick={() => {
                  preview.current?.close();
                  setCompare(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="compare-controls">
              <button
                className={showOriginal ? 'active' : ''}
                onClick={() => setShowOriginal(true)}
              >
                Original / {bytes(active.file.size)}
              </button>
              <button
                className={!showOriginal ? 'active' : ''}
                onClick={() => setShowOriginal(false)}
              >
                {active.result ? `Processed / ${bytes(active.result.blob.size)}` : 'Preview'}
              </button>
            </div>
            <div className="large-preview">
              <img
                src={showOriginal ? active.url : active.result?.url || active.url}
                alt={active.file.name}
              />
            </div>
            <p className="hint">
              {showOriginal
                ? 'Original image'
                : active.result
                  ? `${active.result.width} × ${active.result.height} / ${active.result.blob.type}`
                  : 'Process this image to compare the result.'}
            </p>
          </>
        )}
      </dialog>
    </>
  );
}
