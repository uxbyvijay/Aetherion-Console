import { useEffect, useState, type ReactNode } from 'react';
import { ask } from '../lib/confirm';
import { UserManagement } from './UserManagement';
import { API, api, type Site, type User } from '../api';
import { AiKeys } from './AiKeys';
import { Connectors } from './Connectors';
import { AiToolsConnect } from './AiToolsConnect';
import { LinkedinSetup } from './LinkedinSetup';
import { GithubConnect } from './GithubConnect';
import { ActivityLog } from './ActivityLog';

interface Props { /** a message to show on the LinkedIn page after LinkedIn sent the person back */ notice?: { ok: boolean; message: string }; user: User; site?: Site; sites: Site[]; reload: () => Promise<void>; onSelect: (id: string) => void; /** Goes back to the screen Settings was opened from. */ onBack?: () => void; backLabel?: string; /** Shown in a right panel instead of a whole page. */ panel?: boolean }
/** The menu is about the whole CMS. Each website's own settings live inside "Websites". */
type Section = 'ai' | 'tools' | 'sites' | 'team' | 'log';
type SiteTab = 'website' | 'tools' | 'linkedin' | 'github' | 'connect';

const KEY = 'cms_settings_section';
const ICONS: Record<Section, ReactNode> = {
  ai: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 16v4M17 18h4" /></>,
  tools: <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v4a6 6 0 0 1-12 0z" /><path d="M12 18v3" /></>,
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5a6 6 0 0 1 3 5.5" /></>,
  log: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  sites: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
};
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** One block of the page: a title, a plain sentence about it, then its controls. */
function Block({ title, hint, action, children }: { title: string; hint?: ReactNode; /** a button at the right of the heading */ action?: ReactNode; children: ReactNode }) {
  return (
    <section className="set-block">
      <header className={action ? 'has-action' : undefined}>
        <div><h3>{title}</h3>{hint && <p className="muted">{hint}</p>}</div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Settings(props: Props) {
  const { user, sites, reload, onSelect, onBack, backLabel = 'Structure', panel } = props;
  const canEditAny = sites.some((s) => s.role !== 'VIEWER'); // an editor or admin somewhere
  const allSites = user.isSuperAdmin || user.allSitesRole === 'EDITOR' || user.allSitesRole === 'ADMIN';
  const sections: { id: Section; label: string; show: boolean }[] = [
    { id: 'ai', label: 'AI assistant', show: canEditAny },
    { id: 'tools', label: 'Connect AI tools', show: allSites },
    { id: 'sites', label: 'Websites', show: canEditAny },
    { id: 'team', label: 'User management', show: user.isSuperAdmin },
    { id: 'log', label: 'Activity log', show: user.isSuperAdmin },
  ];
  const visible = sections.filter((s) => s.show);

  // The LinkedIn dialog (and LinkedIn itself, coming back) asks for LinkedIn: that lives inside the website's settings.
  const wantsLinkedin = (() => { try { return !!props.notice || localStorage.getItem(KEY) === 'linkedin'; } catch { return !!props.notice; } })();
  const [pick, setPick] = useState<Section>(() => {
    if (wantsLinkedin) return 'sites';
    const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    return sections.some((s) => s.id === saved) ? (saved as Section) : 'ai';
  });
  const current = visible.find((s) => s.id === pick) ?? visible[0];
  useEffect(() => { try { localStorage.setItem(KEY, current?.id ?? 'ai'); } catch { /* ignore */ } }, [current?.id]);

  // the website open inside "Websites" (none = the list of websites)
  const [targetId, setTargetId] = useState<string | null>(() => (wantsLinkedin ? props.site?.id ?? null : null));
  const [tab, setTab] = useState<SiteTab>(() => (wantsLinkedin ? 'linkedin' : 'website'));
  const target = sites.find((s) => s.id === targetId);
  const admin = target?.role === 'ADMIN';
  const tabs: { id: SiteTab; label: string; show: boolean }[] = [
    { id: 'website', label: 'Website', show: admin },
    { id: 'tools', label: 'AI tools', show: !!target && target.role !== 'VIEWER' },
    { id: 'linkedin', label: 'LinkedIn', show: !!target && target.role !== 'VIEWER' },
    { id: 'github', label: 'GitHub', show: !!target && user.isSuperAdmin },
    { id: 'connect', label: 'Website key', show: admin },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0];

  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); } catch (x) { setErr((x as Error).message); } };

  // website
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [host, setHost] = useState({ dnsName: '', serverName: '', serverPort: '', serverIp: '' });
  const [saved, setSaved] = useState(false);
  // add a website
  const [n, setN] = useState({ name: '', slug: '', domains: '' });
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(target?.name ?? '');
    setDomains(target?.domains.join(', ') ?? '');
    setPreviewUrl(target?.previewUrl ?? '');
    setHost({ dnsName: target?.dnsName ?? '', serverName: target?.serverName ?? '', serverPort: target?.serverPort ? String(target.serverPort) : '', serverIp: target?.serverIp ?? '' });
    setSaved(false);
  }, [target?.id]);

  const websiteChanged = !!target && (name !== target.name || domains !== target.domains.join(', ') || previewUrl !== (target.previewUrl ?? '') || host.dnsName !== (target.dnsName ?? '') || host.serverName !== (target.serverName ?? '') || host.serverPort !== (target.serverPort ? String(target.serverPort) : '') || host.serverIp !== (target.serverIp ?? ''));

  if (!visible.length) {
    return <div className="settings"><h2>Settings</h2><p className="muted">Settings are for editors and admins. Ask an admin if something needs changing.</p></div>;
  }

  // the AI keys work on every site; they are saved through whichever site is at hand
  const keySite = props.site ?? sites.find((s) => s.role !== 'VIEWER') ?? sites[0];
  const ROLE: Record<string, string> = { ADMIN: 'Admin', EDITOR: 'Editor', VIEWER: 'Viewer' };

  return (
    <div className={`settings${panel ? ' in-modal' : ''}`}>
      <header className="set-title">
        {onBack && !panel && (
          <button className="back-btn" onClick={onBack} aria-label={`Back to ${backLabel}`} data-tip={`Back to ${backLabel} (Esc)`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
        <h2>Settings</h2>
        {onBack && panel && (
          <button className="vp-close set-close" onClick={onBack} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
      </header>

      <div className="set-layout">
        <nav className="set-nav" aria-label="Settings sections">
          {visible.map((s) => (
            <button key={s.id} className={current?.id === s.id ? 'on' : ''} aria-current={current?.id === s.id ? 'page' : undefined} onClick={() => { setPick(s.id); setErr(''); if (s.id === 'sites') setTargetId(null); }}>
              <span className="set-ico" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[s.id]}</svg></span>
              <span className="set-txt"><b>{s.label}</b></span>
            </button>
          ))}
        </nav>

        <div className="set-body">
          {err && <p className="err">{err}</p>}

          {/* ---------- AI assistant (the whole CMS) ---------- */}
          {current?.id === 'ai' && keySite && (
            <Block title="AI models" hint="Add the key the AI assistant uses. It works on every site, and is stored encrypted and never shown again.">
              <AiKeys site={keySite} />
            </Block>
          )}

          {/* ---------- Connect AI tools (every site) ---------- */}
          {current?.id === 'tools' && (
            <Block title="Connect AI tools" hint="Keys that let Claude, ChatGPT or any MCP tool work on all your sites. A key for just one site is made inside that site, under Websites.">
              <AiToolsConnect />
            </Block>
          )}

          {/* ---------- User management ---------- */}
          {current?.id === 'team' && user.isSuperAdmin && <UserManagement me={user} />}

          {/* ---------- Activity log ---------- */}
          {current?.id === 'log' && user.isSuperAdmin && <ActivityLog sites={sites} />}

          {/* ---------- Websites: the list, and each website's own settings ---------- */}
          {current?.id === 'sites' && !target && (
            <>
              <Block title="Websites" hint="Each website has its own pages, media and settings. Open one to change its settings."
                action={user.isSuperAdmin ? <button className="primary add-new" onClick={() => { setAdding((a) => !a); setErr(''); }}>{adding ? 'Cancel' : 'Add website'}</button> : undefined}>
                {adding && user.isSuperAdmin && (
                  <div className="site-add">
                    <div className="set-form">
                      <label>Name <input placeholder="My new site" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} autoFocus /></label>
                      <label>Short name for URLs <input placeholder="my-new-site" value={n.slug} onChange={(e) => setN({ ...n, slug: e.target.value })} /><small className="muted">Lowercase letters, digits and dashes.</small></label>
                      <label>Website addresses <input placeholder="newsite.com (optional)" value={n.domains} onChange={(e) => setN({ ...n, domains: e.target.value })} /></label>
                    </div>
                    <div className="row">
                      <button className="primary" disabled={!n.name.trim() || !n.slug.trim()} onClick={() => run(async () => {
                        const s = await api<Site>('/sites', { body: { name: n.name, slug: n.slug, domains: list(n.domains) } });
                        setN({ name: '', slug: '', domains: '' });
                        setAdding(false);
                        await reload(); onSelect(s.id); setTargetId(s.id); setTab('website');
                      })}>Create website</button>
                    </div>
                  </div>
                )}
                <ul className="site-list">
                  {sites.filter((s) => s.role !== 'VIEWER').map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => { setTargetId(s.id); setTab(s.role === 'ADMIN' ? 'website' : 'tools'); setErr(''); }}>
                        <span className="site-dot" aria-hidden>{s.name[0]}</span>
                        <span className="site-name"><b>{s.name}</b><small>{s.domains[0] ?? 'No address yet'}</small></span>
                        <span className="role-badge">{ROLE[s.role]}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </Block>
            </>
          )}

          {current?.id === 'sites' && target && (
            <>
              <div className="site-head">
                <button type="button" className="back-btn" onClick={() => { setTargetId(null); setErr(''); }} aria-label="Back to all websites" data-tip="All websites">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h3>{target.name}</h3>
              </div>
              <div className="set-tabs" role="tablist">
                {visibleTabs.map((t) => <button key={t.id} role="tab" aria-selected={activeTab?.id === t.id} className={activeTab?.id === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setErr(''); }}>{t.label}</button>)}
              </div>

              {/* Website */}
              {activeTab?.id === 'website' && (
                <Block title="Website" hint="The basics. These are only for you and your team, visitors never see them.">
                  <div className="set-form">
                    <label>Name <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></label>
                    <label>
                      Website addresses
                      <input placeholder="yoursite.com, www.yoursite.com" value={domains} onChange={(e) => { setDomains(e.target.value); setSaved(false); }} />
                      <small className="muted">Where the finished site lives. Separate several with commas.</small>
                    </label>
                    <label>
                      Preview address
                      <input placeholder="http://localhost:5180" value={previewUrl} onChange={(e) => { setPreviewUrl(e.target.value); setSaved(false); }} />
                      <small className="muted">The copy of your site that Preview shows while you edit, for example <code>http://localhost:5180</code>.</small>
                    </label>
                  </div>
                  <h4 className="set-sub">Hosting</h4>
                  <p className="muted set-subhint">A note for your team about where this site runs. The CMS only keeps it; nothing uses it.</p>
                  <div className="set-form set-form-2">
                    <label>DNS name <input placeholder="www.yoursite.com" value={host.dnsName} onChange={(e) => { setHost({ ...host, dnsName: e.target.value }); setSaved(false); }} spellCheck={false} /></label>
                    <label>Server name <input placeholder="web-01" value={host.serverName} onChange={(e) => { setHost({ ...host, serverName: e.target.value }); setSaved(false); }} spellCheck={false} /></label>
                    <label>IP address <input placeholder="203.0.113.10" value={host.serverIp} onChange={(e) => { setHost({ ...host, serverIp: e.target.value }); setSaved(false); }} spellCheck={false} /></label>
                    <label>Port <input inputMode="numeric" placeholder="443" value={host.serverPort} onChange={(e) => { setHost({ ...host, serverPort: e.target.value.replace(/\D/g, '') }); setSaved(false); }} /></label>
                  </div>
                  <div className="row">
                    <button className="primary" disabled={!websiteChanged || !name.trim()} onClick={() => run(async () => {
                      await api(`/sites/${target.id}`, { method: 'PATCH', body: { name: name.trim(), domains: list(domains), previewUrl, ...host } });
                      await reload();
                      setSaved(true);
                    })}>Save changes</button>
                    {saved && !websiteChanged && <span className="ok">Saved</span>}
                  </div>
                </Block>
              )}

              {/* AI tools for this website */}
              {activeTab?.id === 'tools' && (
                <>
                  <Block title="Connect AI tools" hint={<>Let Claude, ChatGPT or any MCP tool read and edit <b>{target.name}</b>. Each tool gets its own key. For all sites at once, use <b>Connect AI tools</b> in the main menu.</>}>
                    <AiToolsConnect site={target} />
                  </Block>
                  <Block title="Connectors" hint="Extra places the assistant can read from, such as an MCP server or a REST API. Google Docs need no setup: paste the link in the chat.">
                    <Connectors site={target} />
                  </Block>
                </>
              )}

              {/* LinkedIn */}
              {activeTab?.id === 'linkedin' && (
                <Block title="Post articles to LinkedIn" hint={<>Share an article from {target.name} on your LinkedIn profile. Every post is shown to you first and only goes out when you confirm it, whether you start it here, with the AI assistant or from an AI tool.</>}>
                  <LinkedinSetup site={target} notice={props.notice} />
                </Block>
              )}

              {/* GitHub: where this website publishes to */}
              {activeTab?.id === 'github' && (
                <Block title="Publish through GitHub" hint={<>Link {target.name} to its repository. Approved changes are sent as a pull request that a person reviews and merges on GitHub.</>}>
                  <GithubConnect site={target} />
                </Block>
              )}

              {/* Website key and how to connect */}
              {activeTab?.id === 'connect' && (
                <>
                  <Block title="Your website's key" hint="Your website uses this key to fetch the published content from here. Keep it private; use Rotate if it ever leaks.">
                    <div className="key-line">
                      <code>{target.apiKey}</code>
                      <button onClick={async () => { try { await navigator.clipboard.writeText(target.apiKey ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard not available */ } }}>{copied ? 'Copied' : 'Copy'}</button>
                      <button className="link delete-link always" onClick={() => run(async () => {
                        if (await ask({ title: 'Rotate the key?', message: 'The old key stops working straight away, so your website must be updated with the new one.', confirmLabel: 'Rotate key' })) {
                          await api(`/sites/${target.id}/rotate-key`, { method: 'POST', body: {} });
                          await reload();
                        }
                      })}>Rotate</button>
                    </div>
                  </Block>

                  <Block title="Fetch your content" hint="From any website or app, ask for a page by its address.">
                    <pre>{`fetch('${API}/public/pages/home', {
  headers: { 'x-api-key': 'YOUR_KEY' },
}).then((r) => r.json());
// → { title, sections: [{ _key, _type, ...fields }] }`}</pre>
                  </Block>

                  <Block title="Edit it live (optional)" hint="Lets you click text on your own site, inside Preview, to edit it. It does nothing for normal visitors.">
                    <details>
                      <summary>Show the setup</summary>
                      <pre>{`<!-- 1. Include the script (it does nothing outside the CMS preview) -->
<script src="${API}/sdk/visual-editing.js"></script>

<!-- 2. Mark up what editors can click -->
<h1 data-synx-edit="page.title">Home</h1>
<section data-synx-key="{section._key}">
  <h2 data-synx-edit="{section._key}.heading">...</h2>
  <img data-synx-image="{section._key}.image" src="...">
  <p data-synx-edit="{section._key}.items.2.text">...</p>
</section>

<script>
// 3. Render the draft the CMS sends while editing
window.addEventListener('synx:preview', (e) => {
  const entry = e.detail.entry; // { slug, ...fields, sections: [{ _key, _type, ...fields }] }
  renderPage(entry);
});
</script>`}</pre>
                    </details>
                  </Block>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
