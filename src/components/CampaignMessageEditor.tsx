"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Bold, Italic, Strikethrough, Braces, Paperclip, Smile, Eye, X, Plus, Trash2, FileText, Video, Check, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { type OutboundPayload } from '@/lib/messaging-contracts';
import { injectVariables, parseSpintax } from '@/lib/spintax';
import { missingVariables } from '@/lib/campaign-personalization';
import MessageFields from './MessageFields';

export type CampaignVariant = { id: string; label: string; weight: number; enabled?: boolean; spintaxTemplate: string; payload: OutboundPayload };
type Sample = { id: string; name: string | null; values: Record<string, string> };
const bodyOf = (payload: OutboundPayload) => payload.type === 'text' ? payload.text : payload.type === 'media' ? payload.caption || '' : '';
const emojis = ['😊', '👋', '💚', '🎉', '👍', '✨', '🙏', '📦', '📍', '✅', '💬', '🔥'];

export default function CampaignMessageEditor({ campaignId, variants, onChange, distribution, onDistributionChange, onPreparingAttachment }: {
  campaignId: string; variants: CampaignVariant[]; onChange: Dispatch<SetStateAction<CampaignVariant[]>>;
  distribution: string; onDistributionChange: (value: string) => void;
  onPreparingAttachment: (value: boolean) => void;
}) {
  const [activeId, setActiveId] = useState(variants[0]?.id);
  const [variables, setVariables] = useState<string[]>(['name', 'first_name', 'last_name', 'phone']);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleId, setSampleId] = useState('');
  const [panel, setPanel] = useState<'variables' | 'emoji' | null>(null);
  const [customKey, setCustomKey] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingVariables, setLoadingVariables] = useState(true);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const active = variants.find(item => item.id === activeId) || variants[0];
  const text = active ? bodyOf(active.payload) : '';
  const sample = samples.find(item => item.id === sampleId) || samples[0];
  const missing = missingVariables(text, sample?.values || {});
  const canCompose = active?.payload.type === 'text' || active?.payload.type === 'media';

  useEffect(() => {
    let alive = true;
    authenticatedFetch(`/api/campaigns/${campaignId}/variables`).then(res => res.json()).then(data => {
      if (alive) { setVariables(data.variables); setSamples(data.samples); setSampleId(data.samples[0]?.id || ''); }
    }).catch(cause => { if (alive) setError(cause.message); }).finally(() => { if (alive) setLoadingVariables(false); });
    return () => { alive = false; };
  }, [campaignId]);

  useEffect(() => {
    if (preview) setPreviewText(parseSpintax(injectVariables(text, sample?.values || {})));
  }, [text, sample, preview]);

  function update(patch: Partial<CampaignVariant>) {
    onChange(previous => previous.map(item => item.id === active.id ? { ...item, ...patch } : item));
  }
  function updateText(value: string) {
    update({ payload: active.payload.type === 'media' ? { ...active.payload, caption: value } : { type: 'text', text: value }, spintaxTemplate: value });
  }
  function insert(value: string, wrap = false) {
    let { start, end } = selection.current;
    if (value.startsWith('{{') && text.slice(0, start).endsWith('{{')) start -= 2;
    const selected = text.slice(start, end);
    const addition = wrap ? value + selected + value : value;
    updateText(text.slice(0, start) + addition + text.slice(end));
    setPanel(null);
    requestAnimationFrame(() => {
      const cursor = start + (wrap ? value.length + selected.length : addition.length);
      textRef.current?.focus(); textRef.current?.setSelectionRange(cursor, cursor); selection.current = { start: cursor, end: cursor };
    });
  }
  function addVariant() {
    if (variants.length >= 20) return;
    const id = crypto.randomUUID();
    onChange([...variants, { id, label: `Variant ${String.fromCharCode(65 + variants.length)}`, weight: 50, enabled: true, spintaxTemplate: '', payload: { type: 'text', text: '' } }]);
    setActiveId(id); setPreview(false); setPanel(null); selection.current = { start: 0, end: 0 };
  }
  async function attach(file: File) {
    setError('');
    if (file.size > 8 * 1024 * 1024) { setError('Choose an attachment up to 8 MB.'); return; }
    if (!file.size) { setError('This file is empty. Choose another attachment.'); return; }
    setUploading(true);
    onPreparingAttachment(true);
    try {
      const media = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the attachment.')); reader.readAsDataURL(file);
      });
      onChange(previous => previous.map(item => item.id === active.id ? { ...item, payload: { type: 'media', mediatype: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document', media, caption: bodyOf(item.payload), fileName: file.name, mimetype: file.type || 'application/octet-stream' } } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attachment failed.'); }
    finally { setUploading(false); onPreparingAttachment(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function showPreview() { setPreview(true); setPreviewText(parseSpintax(injectVariables(text, sample?.values || {}))); }
  if (!active) return null;

  return <section className="campaign-editor" aria-label="Campaign message editor">
    <div className="campaign-editor-workspace">
      <div className="campaign-compose-panel">
        <div className="campaign-compose-heading">
          <div><label htmlFor="variant-name">Message variant</label><input id="variant-name" value={active.label} maxLength={100} onChange={event => update({ label: event.target.value })} /></div>
          <button type="button" className="campaign-editor-button" onClick={showPreview}><Eye size={16} /> Preview</button>
        </div>
        {canCompose ? <div className="campaign-compose-surface">
          <textarea ref={textRef} aria-label="Campaign message" placeholder="Write your message. Type {{ to add a lead variable." value={text} maxLength={4096}
            onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
            onChange={event => { const value = event.target.value; updateText(value); selection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; if (value.slice(0, event.target.selectionStart).endsWith('{{')) setPanel('variables'); }} />
          {active.payload.type === 'media' && <div className="campaign-attachment">
            {active.payload.mediatype === 'image' && active.payload.media && !active.payload.media.startsWith('asset:') ? <img src={active.payload.media.startsWith('https://') || active.payload.media.startsWith('data:') ? active.payload.media : `data:${active.payload.mimetype || 'image/jpeg'};base64,${active.payload.media}`} alt="Campaign attachment preview" /> : active.payload.mediatype === 'video' ? <Video size={22} /> : <FileText size={22} />}
            <div><strong>{active.payload.fileName || 'Attached media'}</strong><small>{active.payload.mediatype === 'document' ? 'Document attachment' : `${active.payload.mediatype} · Message sent as caption`}</small></div>
            <button type="button" aria-label="Remove attachment" onClick={() => update({ payload: { type: 'text', text } })}><X size={16} /></button>
          </div>}
          <div className="campaign-compose-toolbar">
            <div><button type="button" title="Bold" aria-label="Bold" onClick={() => insert('*', true)}><Bold size={17} /></button><button type="button" title="Italic" aria-label="Italic" onClick={() => insert('_', true)}><Italic size={17} /></button><button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => insert('~', true)}><Strikethrough size={17} /></button><span className="campaign-toolbar-divider" /><button type="button" aria-label="Insert variable" aria-expanded={panel === 'variables'} onClick={() => setPanel(panel === 'variables' ? null : 'variables')}><Braces size={18} /></button><button type="button" aria-label="Insert emoji" aria-expanded={panel === 'emoji'} onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}><Smile size={18} /></button><button type="button" aria-label="Attach file" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}</button></div>
            <small>{text.length.toLocaleString()} / 4,096</small>
          </div>
          <input ref={fileRef} type="file" aria-label="Campaign attachment" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file); }} />
          {panel === 'variables' && <div className="campaign-insert-panel"><div className="campaign-insert-heading"><strong>Insert a variable</strong><button type="button" aria-label="Close variable picker" onClick={() => setPanel(null)}><X size={16} /></button></div><p>Values come from each lead’s name, phone, and imported columns.</p><div className="campaign-variable-options">{variables.map(key => <button type="button" key={key} onClick={() => { const prefix = text.slice(0, selection.current.start); if (prefix.endsWith('{{')) selection.current.start -= 2; insert(`{{${key}}}`); }}>{'{{' + key + '}}'}</button>)}</div><div className="campaign-custom-variable"><input aria-label="Custom variable column" placeholder="Imported column name" value={customKey} onChange={event => setCustomKey(event.target.value)} maxLength={100} /><button type="button" disabled={!customKey.trim() || /[{}]/.test(customKey)} onClick={() => { const key = customKey.trim(); setVariables(previous => [...new Set([...previous, key])]); if (text.slice(0, selection.current.start).endsWith('{{')) selection.current.start -= 2; insert(`{{${key}}}`); setCustomKey(''); }}><Plus size={15} /> Insert</button></div><small>A new variable needs a value in the matching lead column before launch.</small></div>}
          {panel === 'emoji' && <div className="campaign-emoji-panel" aria-label="Emoji picker">{emojis.map(emoji => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => insert(emoji)}>{emoji}</button>)}<button type="button" aria-label="Close emoji picker" onClick={() => setPanel(null)}><X size={16} /></button></div>}
        </div> : <div className="campaign-legacy-content"><p>This variant contains advanced WhatsApp content. You can keep editing it or start a text message.</p><button type="button" className="campaign-editor-button" onClick={() => update({ payload: { type: 'text', text: '' } })}>Use message composer</button><MessageFields value={active.payload} onChange={payload => update({ payload })} /></div>}
        <div className="campaign-quick-insert"><span>Personalize</span>{variables.slice(0, 5).map(key => <button type="button" key={key} onClick={() => insert(`{{${key}}}`)}>{'{{' + key + '}}'}</button>)}</div>
        <p className="campaign-editor-hint">Add one image, video, or file per variant. Use {'{Hi|Hello}'} for wording variations.</p>
        {error && <p role="alert" className="app-error">{error}</p>}
      </div>
      <aside className="campaign-variant-rail" aria-label="Message variants">
        <button type="button" className="campaign-add-variant" disabled={variants.length >= 20} onClick={addVariant}><Plus size={17} /> Add variant</button>
        {variants.map((item, index) => <div key={item.id} className={`campaign-variant-card ${item.id === active.id ? 'is-active' : ''}`}>
          <button type="button" className="campaign-variant-select" aria-pressed={item.id === active.id} onClick={() => { setActiveId(item.id); setPreview(false); setPanel(null); selection.current = { start: 0, end: 0 }; }}><strong>{item.label || `Variant ${String.fromCharCode(65 + index)}`}</strong>{item.id === active.id && <Check size={15} />}<small>{bodyOf(item.payload) || (item.payload.type !== 'text' ? 'Attachment message' : 'Write a message')}</small></button>
          <div className="campaign-variant-controls"><span>Enabled</span><button type="button" role="switch" aria-label={`Enable ${item.label}`} aria-checked={item.enabled !== false} className="campaign-toggle" onClick={() => onChange(variants.map(variant => variant.id === item.id ? { ...variant, enabled: variant.enabled === false } : variant))}><span /></button>{variants.length > 1 && <button type="button" aria-label={`Remove ${item.label}`} onClick={() => { const remaining = variants.filter(variant => variant.id !== item.id); onChange(remaining); if (active.id === item.id) setActiveId(remaining[0].id); }}><Trash2 size={15} /></button>}</div>
        </div>)}
        <label className="campaign-distribution">Send variants<select value={distribution} onChange={event => onDistributionChange(event.target.value)}><option value="round_robin">Rotate evenly</option><option value="weighted">By weight</option><option value="account_locked">By sending account</option></select></label>
        {distribution === 'weighted' && <label className="campaign-distribution">Weight for {active.label}<input aria-label="Variant weight" type="number" min={1} max={100} value={active.weight} onChange={event => update({ weight: Number(event.target.value) })} /></label>}
      </aside>
    </div>
    {preview && <div className="campaign-preview" role="region" aria-label="Personalized message preview"><div className="campaign-preview-heading"><strong>Message preview</strong><button type="button" aria-label="Close preview" onClick={() => setPreview(false)}><X size={18} /></button></div>{loadingVariables ? <p>Loading lead data…</p> : samples.length ? <label>Preview with<select aria-label="Preview lead" value={sampleId} onChange={event => { setSampleId(event.target.value); const next = samples.find(item => item.id === event.target.value); setPreviewText(parseSpintax(injectVariables(text, next?.values || {}))); }}>{samples.map(item => <option key={item.id} value={item.id}>{item.name || '+' + item.values.phone}</option>)}</select></label> : <p>Add leads to preview their personalized values.</p>}<div className="campaign-preview-bubble">{previewText || 'Your message is empty.'}</div>{missing.length > 0 && <p className="campaign-preview-warning">Missing values: {missing.map(key => '{{' + key + '}}').join(', ')}. Complete these lead fields before launching.</p>}<button type="button" className="campaign-editor-button" onClick={showPreview}>Refresh wording</button></div>}
  </section>;
}
