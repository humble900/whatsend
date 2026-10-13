"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Check, ChevronLeft, ChevronRight, Loader2, ArrowUpRight } from 'lucide-react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { campaignAllowance, MAX_CAMPAIGN_ACCOUNTS } from '@/lib/campaign-rotation';

type Account = { id: string; name: string; phoneNumber: string | null; status: string; dailyLimit: number; accountUsed: number; campaignUsed: number };
type OptionsCampaign = { id: string; status: string; totalContacts: number; dailyLimitPerAccount: number; stopOnReply?: boolean; timezone: string; assignedAccounts: { id: string }[]; variants: { enabled?: boolean }[]; variantMode: string; spintaxTemplate?: string };
export default function CampaignOptions({ campaign, onSaved, onEditMessages, onDirtyChange }: { campaign: OptionsCampaign; onSaved: () => Promise<void>; onEditMessages: () => void; onDirtyChange?: (dirty:boolean)=>void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(campaign.assignedAccounts.map(account => account.id)));
  const [limit, setLimit] = useState(campaign.dailyLimitPerAccount);
  const [stopOnReply, setStopOnReply] = useState(campaign.stopOnReply !== false);
  const [query, setQuery] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(campaign.status !== 'draft');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loaded,setLoaded]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const editable = campaign.status === 'draft';
  const snapshot=JSON.stringify({instanceIds:[...selected].sort(),limit,stopOnReply});
  const baseline=useRef(snapshot);
  const dirty=snapshot!==baseline.current;
  useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
  function discard(){const stored=JSON.parse(baseline.current) as {instanceIds:string[];limit:number;stopOnReply:boolean};setSelected(new Set(stored.instanceIds));setLimit(stored.limit);setStopOnReply(stored.stopOnReply);setSaved(false);setError('');}
  useEffect(() => {
    let alive = true;
    setLoading(true);setLoaded(false);setError('');
    authenticatedFetch(`/api/campaigns/${campaign.id}/senders`).then(response => response.json()).then(data => { if (alive) {setAccounts(data.accounts);setLoaded(true);} }).catch(cause => { if (alive) setError(cause.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaign.id,refreshKey]);
  useEffect(() => { setPage(1); }, [query, selectedOnly]);
  useEffect(() => { setSaved(false); }, [selected, limit, stopOnReply]);
  const selectedAccounts = useMemo(() => accounts.filter(account => selected.has(account.id)), [accounts, selected]);
  const connected = selectedAccounts.filter(account => account.status === 'connected');
  const capacity = connected.reduce((sum, account) => sum + Math.min(account.dailyLimit, Number.isFinite(limit) ? limit : 0), 0);
  const remaining = connected.reduce((sum, account) => sum + campaignAllowance(account.dailyLimit, limit, account.accountUsed, account.campaignUsed), 0);
  const filtered = useMemo(() => accounts.filter(account => (!selectedOnly || selected.has(account.id)) && `${account.name} ${account.phoneNumber || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [accounts, query, selected, selectedOnly]);
  const visible = filtered.slice((page - 1) * 50, page * 50);
  useEffect(()=>setPage(value=>Math.min(value,Math.max(1,Math.ceil(filtered.length/50)))),[filtered.length]);
  const enabledVariants = campaign.variants?.length ? campaign.variants.filter(variant => variant.enabled !== false).length : campaign.spintaxTemplate?.trim() ? 1 : 0;
  function toggle(account: Account) {
    setSaved(false);
    if (!selected.has(account.id) && selected.size >= MAX_CAMPAIGN_ACCOUNTS) { setError('A campaign can use up to 1,000 sending accounts.'); return; }
    setError(''); setSelected(previous => { const next = new Set(previous); if (next.has(account.id)) next.delete(account.id); else next.add(account.id); return next; });
  }
  function selectConnected() {
    const candidates = filtered.filter(account => account.status === 'connected');
    const next = new Set(selected);
    for (const account of candidates) { if (next.size >= MAX_CAMPAIGN_ACCOUNTS && !next.has(account.id)) break; next.add(account.id); }
    setSelected(next);
    setError(candidates.some(account => !next.has(account.id)) ? 'Selected up to the 1,000-account limit. Use search to adjust your selection.' : '');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false);
    try {
      await authenticatedFetch(`/api/campaigns/${campaign.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceIds: [...selected], dailyLimitPerAccount: limit, stopOnReply }) });
      await onSaved(); baseline.current=snapshot;onDirtyChange?.(false);setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save campaign options.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="campaign-options-layout">
    <div className="campaign-options-main">
      <section className="campaign-option-card">
        <div className="campaign-option-heading"><div><h2>Sending accounts</h2><p>Choose the WhatsApp accounts that will share this campaign.</p></div><span>{selected.size.toLocaleString()} selected</span></div>
        <div className="campaign-sender-search"><Search size={16} /><input aria-label="Search sending accounts" placeholder="Search by account name or number" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="campaign-selection-actions"><button type="button" disabled={loading||busy} onClick={()=>setRefreshKey(value=>value+1)}>Refresh</button><button type="button" disabled={!editable || busy || !loaded} onClick={selectConnected}>{query ? 'Select matching connected accounts' : 'Select all connected'}</button><button type="button" disabled={!editable || busy || !selected.size} onClick={() => setSelected(new Set())}>Clear</button><button type="button" className={selectedOnly ? 'is-selected' : ''} aria-pressed={selectedOnly} onClick={() => setSelectedOnly(value => !value)}>Selected only</button></div>
        <div className="campaign-sender-list" aria-label="Sending accounts list" aria-busy={loading}>
          {loading ? <div className="campaign-sender-empty"><Loader2 size={18} className="animate-spin" /> Loading sending accounts…</div> : !filtered.length ? <div className="campaign-sender-empty">{accounts.length ? 'No accounts match this view.' : 'Connect a WhatsApp account in Numbers to start.'}</div> : visible.map(account => <label key={account.id} className={`campaign-sender-row ${selected.has(account.id) ? 'is-selected' : ''}`}>
            <input type="checkbox" aria-label={`Use ${account.name}`} checked={selected.has(account.id)} disabled={!editable || busy || (account.status !== 'connected' && !selected.has(account.id))} onChange={() => toggle(account)} />
            <div className="campaign-sender-identity"><strong>{account.name}</strong><small>{account.phoneNumber ? '+' + account.phoneNumber.replace(/\D/g, '') : 'Number not available'}</small></div>
            <div className="campaign-sender-status"><span className={account.status === 'connected' ? 'is-connected' : ''}>{account.status === 'connected' ? 'Connected' : account.status}</span><small>{account.status === 'connected' ? `${campaignAllowance(account.dailyLimit, limit, account.accountUsed, account.campaignUsed).toLocaleString()} available today` : 'Reconnect before launch'}</small></div>
          </label>)}
        </div>
        <div className="campaign-sender-pagination"><span>{filtered.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, filtered.length)} of {filtered.length.toLocaleString()}</span><div><button type="button" aria-label="Previous sending accounts" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Next sending accounts" disabled={page * 50 >= filtered.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={16} /></button></div></div>
        {!loading&&!loaded&&<button type="button" className="campaign-editor-button" onClick={()=>setRefreshKey(value=>value+1)}>Retry loading accounts</button>}
        <p className="campaign-options-note">Recipients rotate across selected accounts with available daily capacity. Each recipient keeps their assigned sender; a disconnected sender’s queued messages wait for reconnection.</p>
      </section>
      <section className="campaign-option-card"><h2>Sending limits</h2><div className="campaign-limit-setting"><label htmlFor="campaign-account-limit">Maximum messages per account, per campaign day<small>The lower account-wide cap still applies across all campaigns.</small></label><input id="campaign-account-limit" aria-label="Campaign daily limit per account" type="number" min={1} max={1000} required value={limit} disabled={!editable || busy} onChange={event => setLimit(Number(event.target.value))} /></div><p className="campaign-options-note">Campaign days follow {campaign.timezone}. Account-wide campaign caps reset at 00:00 UTC. Sending and uncertain requests reserve capacity until their outcome is resolved.</p></section>
      <section className="campaign-option-card"><h2>Reply handling</h2><div className="campaign-rule-row"><div><strong>Stop queued messages after a reply</strong><p>Skip remaining campaign messages to a recipient who replies after this campaign starts.</p></div><button type="button" role="switch" aria-label="Stop queued campaign messages on reply" aria-checked={stopOnReply} disabled={!editable || busy} className="campaign-options-toggle" onClick={() => setStopOnReply(value => !value)}><span /></button></div><div className="campaign-rule-row"><div><strong>Honor opt-outs</strong><p>Opted-out recipients are excluded before each send.</p></div><Check size={17} className="campaign-rule-check" /></div><p className="campaign-options-note">Campaign schedules and limits do not delay direct inbox replies.</p></section>
      {error && <p role="alert" className="app-error">{error}</p>}
      {editable ? <div className="campaign-options-save"><button className="profile-button" disabled={busy || !loaded}>{busy ? 'Saving…' : 'Save options'}</button>{dirty&&<button type="button" className="campaign-editor-button" disabled={busy} onClick={discard}>Discard changes</button>}{saved && <span role="status">Options saved</span>}</div> : <p className="campaign-options-note">Sender selection and campaign limits are fixed after launch.</p>}
    </div>
    <aside className="campaign-plan-card"><h3>Delivery plan</h3><dl><div><dt>Recipients</dt><dd>{campaign.totalContacts.toLocaleString()}</dd></div><div><dt>Selected accounts</dt><dd>{selected.size.toLocaleString()}</dd></div><div><dt>Connected senders</dt><dd>{loaded?connected.length.toLocaleString():"—"}</dd></div><div><dt>Combined daily capacity</dt><dd>{loaded?capacity.toLocaleString():"—"}</dd></div><div><dt>Available today</dt><dd>{loaded?remaining.toLocaleString():"—"}</dd></div><div><dt>Average recipients / account</dt><dd>{selected.size ? (campaign.totalContacts / selected.size).toLocaleString(undefined,{maximumFractionDigits:1}) : '—'}</dd></div></dl><p>Capacity respects both campaign and account limits. It is a planning limit, not a provider delivery guarantee.</p>{loaded && selected.size > connected.length && <p className="campaign-plan-warning">{selected.size - connected.length} selected accounts need to reconnect before launch.</p>}<div className="campaign-plan-variants"><strong>{enabledVariants} enabled message {enabledVariants===1?"variant":"variants"}</strong><span>{campaign.variantMode === 'weighted' ? 'Distributed by weight' : campaign.variantMode === 'account_locked' ? 'One variant per sending account' : 'Variants rotate on each account’s turn'}</span><button type="button" onClick={onEditMessages}>Edit messages <ArrowUpRight size={14} /></button></div></aside>
  </form>;
}
