import React, { useState } from 'react';
import { apiPost, getDb, sanitizeKey } from '../services/api';

const groups = {
  Career: ['Matches'],
  Batting: ['Runs', "100's", "50's", "30's", 'SR', 'Avg'],
  Bowling: ['Wickets','5 Wkts','3 Wkts','Economy'],
  Fielding: ['Catches','Runouts']
};
const labels = { SR: 'Strike Rate', Avg: 'Batting Avg' };

async function refreshAuctionStats(event, profile, changes) {
  const db = await getDb();
  if (!db) throw Error('Auction database unavailable');
  const matches = player => player &&
    String(player.Name || player.name || player.playerName || '').trim() === profile.name.trim() &&
    String(player['Booking ID'] ?? player.bookingId ?? player.id ?? '').trim() === profile.booking.trim();
  const paths = ['auctions/' + event + '/players'];
  if (event === 'ESL2026') paths.push('eslAuction/players');
  const refresh = async ref => {
    await ref.once('value');
    await ref.transaction(player => matches(player) ? {...player,...changes} : undefined, undefined, false);
  };
  for (const path of paths) {
    const roster = await db.ref(path).once('value');
    const candidates = [];
    roster.forEach(child => { if (matches(child.val())) candidates.push(child.ref); });
    if (candidates.length === 1) await refresh(candidates[0]);
  }
  await refresh(db.ref('players/' + event + '/' + sanitizeKey(profile.name)));
}

export default function PlayerStatsEditor({eventCode}) {
  const [bookingId,setBookingId] = useState('');
  const [session,setSession] = useState('');
  const [profiles,setProfiles] = useState([]);
  const [id,setId] = useState('');
  const [stats,setStats] = useState({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  function select(profile) {
    setId(profile?.id || '');
    setStats(profile?.stats || {});
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      let payload;
      if (session) {
        const original = profiles.find(p => p.id === id).stats;
        const changes = Object.fromEntries(Object.entries(stats).filter(([k,v])=>v !== original[k]));
        if (!Object.keys(changes).length) { setMessage('No changes to save.'); return; }
        payload = {action:'saveCareerStats',session,profileId:id,stats:changes};
      } else {
        payload = {action:'lookupCareerBooking',bookingId:bookingId.trim()};
      }
      const result = await apiPost({...payload,eventCode});
      if (result.error) throw Error(result.error);
      if (session) {
        setProfiles(profiles.map(p=>p.id === id ? {...p,stats} : p));
        try {
          await refreshAuctionStats(eventCode, profiles.find(p=>p.id===id), payload.stats);
          setMessage('Career statistics saved.');
        } catch {
          setMessage('Statistics saved to the registration sheet. The auction display could not be refreshed.');
        }
      } else {
        if (!result.session || !result.profiles?.length) throw Error('Unable to load registration.');
        setSession(result.session);
        setProfiles(result.profiles);
        select(result.profiles.length === 1 ? result.profiles[0] : null);

      }
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  return <main className="glass-panel career-editor"><h1>Update career statistics</h1><p>{eventCode}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {!session && <label>Booking ID<input type="text" maxLength={150} required value={bookingId} onChange={e=>setBookingId(e.target.value)} /></label>}
      {session && <label>Player profile<select value={id} onChange={e=>{ select(profiles.find(p=>p.id===e.target.value)); setMessage(''); }}>
        <option value="">Choose a registration</option>{profiles.map((p,i)=><option key={p.id} value={p.id}>{p.name} · {p.booking || 'Registration '+(i+1)}</option>)}
      </select></label>}
      {id && Object.entries(groups).map(([group,fields])=><section key={group}><h2>{group}</h2><div>{fields.map(key=><label key={key}>{labels[key] || key}<input type="number" min="0" step={labels[key] || key==='Economy' ? 'any' : '1'} value={stats[key] ?? ''} onChange={e=>setStats({...stats,[key]:e.target.value})}/></label>)}</div></section>)}
      <button type="submit" className="btn btn-primary" disabled={busy || Boolean(session && !id)}>{session ? 'Save statistics' : 'Find registration'}</button>
      {session && <button type="button" className="btn btn-outline" onClick={()=>{setSession('');setBookingId('');select(null);setProfiles([]);setMessage('');}}>Finish</button>}
    </fieldset></form><p role="status">{message}</p></main>;
}
