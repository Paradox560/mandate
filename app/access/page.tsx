'use client';

import {useEffect, useState, type CSSProperties} from 'react';

function safeReturnTo(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/?judge=1';
  const url = new URL(value, 'https://local.invalid');
  return url.origin === 'https://local.invalid' && !/^\/(access|api)(\/|$)/.test(url.pathname)
    ? url.pathname + url.search + url.hash : '/?judge=1';
}

const pageStyle: CSSProperties = {minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f3f5f6'};
const panelStyle: CSSProperties = {width: 'min(100%,440px)', background: 'white', padding: 36, border: '1px solid #dfe5e8', borderRadius: 22};
const titleStyle: CSSProperties = {fontSize: 30, letterSpacing: '-1px', marginBottom: 12};
const descriptionStyle: CSSProperties = {fontSize: 14, color: '#667581', lineHeight: 1.7, marginBottom: 24};
const buttonStyle: CSSProperties = {marginTop: 24, width: '100%', padding: 14, borderRadius: 12, background: '#007e76', color: 'white', fontSize: 14};

export default function AccessPage() {
  const [mode, setMode] = useState<'code' | 'open'>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [framed, setFramed] = useState<boolean | null>(null);
  const [fullPageHref, setFullPageHref] = useState('/access');
  const destination = () => safeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));

  useEffect(() => {
    if (window.self !== window.top) {
      setFramed(true);
      setFullPageHref('/access?returnTo=' + encodeURIComponent(destination()));
      return;
    }
    setFramed(false);
    let active = true;
    fetch('/api/session', {cache: 'no-store'}).then(async response => {
      const body = await response.json() as {error?: string; mode: 'code' | 'open'; authenticated?: boolean};
      if (!response.ok) throw new Error(body.error || 'Session unavailable.');
      if (!active) return;
      if (body.authenticated) window.location.replace(destination());
      setMode(body.mode); setReady(true);
    }).catch(error => {if (active) setError(error.message);});
    return () => {active = false;};
  }, [attempt]);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    // Embedded previews must not enter a cookie/login retry loop.
    if (window.self !== window.top) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code})});
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error || 'Unable to open your workspace.');
      window.location.assign(destination());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please retry.'); setBusy(false);
    }
  }

  if (framed === null) return <main style={pageStyle}><div style={panelStyle}><p role="status">Opening your workspace…</p></div></main>;
  if (framed) return <main style={pageStyle}><section style={panelStyle} aria-labelledby="full-page-title">
    <div style={{color: '#087f76', fontWeight: 650, marginBottom: 28}}>mandate.</div>
    <h1 id="full-page-title" style={titleStyle}>Open your workspace in a full page.</h1>
    <p style={descriptionStyle}>Your browser protects workspace sessions inside embedded previews. Open the full page to continue.</p>
    <a href={fullPageHref} target="_blank" rel="noopener noreferrer" style={{...buttonStyle, display: 'block', textAlign: 'center'}}>Open workspace in a new tab</a>
  </section></main>;

  return <main style={pageStyle}><form onSubmit={enter} style={panelStyle}>
    <div style={{color: '#087f76', fontWeight: 650, marginBottom: 28}}>mandate.</div>
    <h1 style={titleStyle}>Your paper investment desk.</h1>
    <p style={descriptionStyle}>{mode === 'code' ? 'Enter the demo access code supplied by your host.' : 'Open your own paper workspace to explore research and permissions.'} Each browser gets a separate account. No brokerage is connected.</p>
    {mode === 'code' && <label style={{display: 'grid', gap: 8, fontSize: 13}}>Demo access code<input autoComplete="current-password" type="password" inputMode="numeric" value={code} onChange={event => setCode(event.target.value)} required minLength={4} maxLength={128} pattern="[0-9]{4}|.{12,128}" title="Enter the four-digit demo code or the longer access code supplied by your host." style={{border: '1px solid #cdd8d8', borderRadius: 10, padding: 13, fontSize: 16}} /></label>}
    {error && <p role="alert" style={{fontSize: 13, color: '#a13846', lineHeight: 1.6, marginTop: 18}}>{error}</p>}
    {!ready && error && <button type="button" onClick={() => {setError(''); setAttempt(value => value + 1);}} style={{marginTop: 12, color: '#007e76', fontSize: 14, textDecoration: 'underline'}}>Retry connection</button>}
    <button disabled={!ready || busy} type="submit" style={{...buttonStyle, opacity: !ready || busy ? 0.55 : 1}}>{busy ? 'Opening workspace…' : 'Open workspace'}</button>
    <p style={{fontSize: 11, color: '#7e8992', lineHeight: 1.6, marginTop: 20}}>Sessions last 12 hours. A new session starts a separate paper account.</p>
  </form></main>;
}
