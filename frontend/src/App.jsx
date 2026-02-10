import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Rocket, Box, Activity, Terminal as TerminalIcon, Plus, Trash2, StopCircle } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
const socket = io(API_BASE);

function App() {
  const [bots, setBots] = useState([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [buildCmd, setBuildCmd] = useState('npm install');
  const [runCmd, setRunCmd] = useState('node index.js');
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [logs, setLogs] = useState({});
  const [activeBotId, setActiveBotId] = useState(null);

  const terminalEndRef = useRef(null);

  useEffect(() => {
    fetchBots();
    socket.on('log', ({ id, text }) => {
      setLogs(prev => ({
        ...prev,
        [id]: [...(prev[id] || []), { text, timestamp: new Date().toLocaleTimeString() }]
      }));
    });
    return () => socket.off('log');
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeBotId]);

  const fetchBots = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/bots`);
      setBots(res.data);
    } catch (e) {
      console.error("Failed to fetch bots", e);
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    const env = envVars.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {});

    try {
      const res = await axios.post(`${API_BASE}/api/deploy`, {
        repoUrl, buildCmd, runCmd, envVars: env
      });
      setActiveBotId(res.data.id);
      fetchBots();
    } catch (e) {
      alert("Deployment failed to start");
    }
  };

  const stopBot = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/stop/${id}`);
      fetchBots();
    } catch (e) {
      alert("Failed to stop bot");
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index) => setEnvVars(envVars.filter((_, i) => i !== index));

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h1 className="title-gradient" style={{ fontSize: '1.5rem' }}>BotDeploy</h1>

        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Bots</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bots.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>No bots deployed yet.</p>}
            {bots.map(bot => (
              <div
                key={bot.id}
                className={`glass-card ${activeBotId === bot.id ? 'active' : ''}`}
                style={{ padding: '0.75rem', cursor: 'pointer', borderLeft: activeBotId === bot.id ? '4px solid var(--accent)' : '' }}
                onClick={() => setActiveBotId(bot.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{bot.repoName}</span>
                  <span className={`status-badge status-${bot.status}`}>{bot.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{activeBotId ? 'Bot Details' : 'Deploy New Bot'}</h2>
          {activeBotId && (
            <button className="btn btn-primary" onClick={() => setActiveBotId(null)}>
              <Plus size={18} /> New Deployment
            </button>
          )}
        </div>

        {!activeBotId ? (
          <form className="glass-card" onSubmit={handleDeploy}>
            <div className="input-group">
              <label>GitHub Repository URL</label>
              <input
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label>Build Command</label>
                <input value={buildCmd} onChange={e => setBuildCmd(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Run Command</label>
                <input value={runCmd} onChange={e => setRunCmd(e.target.value)} required />
              </div>
            </div>

            <div className="input-group">
              <label>Environment Variables</label>
              {envVars.map((env, i) => (
                <div key={i} className="env-row">
                  <input
                    placeholder="KEY"
                    value={env.key}
                    onChange={e => {
                      const newVars = [...envVars];
                      newVars[i].key = e.target.value;
                      setEnvVars(newVars);
                    }}
                  />
                  <input
                    placeholder="VALUE"
                    value={env.value}
                    onChange={e => {
                      const newVars = [...envVars];
                      newVars[i].value = e.target.value;
                      setEnvVars(newVars);
                    }}
                  />
                  <button type="button" className="btn" onClick={() => removeEnvVar(i)} style={{ padding: '0.5rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn" onClick={addEnvVar} style={{ marginTop: '0.5rem', width: 'fit-content', background: 'rgba(255,255,255,0.05)' }}>
                <Plus size={16} /> Add Variable
              </button>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
              <Rocket size={18} /> Deploy Bot
            </button>
          </form>
        ) : (
          <div className="bot-details" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>{bots.find(b => b.id === activeBotId)?.repoName}</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>{bots.find(b => b.id === activeBotId)?.repoUrl}</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {bots.find(b => b.id === activeBotId)?.status === 'running' && (
                  <button className="btn btn-primary" style={{ background: '#ef4444' }} onClick={() => stopBot(activeBotId)}>
                    <StopCircle size={18} /> Stop Bot
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TerminalIcon size={18} />
                <h3 style={{ fontSize: '1rem' }}>Live Logs</h3>
              </div>
              <div className="terminal">
                {(logs[activeBotId] || []).map((log, i) => (
                  <div key={i} className="log-line">
                    <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>[{log.timestamp}]</span>
                    {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
