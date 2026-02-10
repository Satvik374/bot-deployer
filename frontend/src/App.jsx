import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  Rocket, Box, Activity, Terminal as TerminalIcon,
  Plus, Trash2, StopCircle, RefreshCw, Github, Cpu,
  Server, Globe, ChevronRight
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
const socket = io(API_BASE);

function App() {
  const [bots, setBots] = useState([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [buildCmd, setBuildCmd] = useState('npm install');
  const [runCmd, setRunCmd] = useState('node index.js');
  const [proxy, setProxy] = useState('');
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [logs, setLogs] = useState({});
  const [activeBotId, setActiveBotId] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const terminalEndRef = useRef(null);

  useEffect(() => {
    fetchBots();
    socket.on('log', ({ id, text }) => {
      setLogs(prev => ({
        ...prev,
        [id]: [...(prev[id] || []), { text, timestamp: new Date().toLocaleTimeString([], { hour12: false }) }]
      }));
    });
    return () => socket.off('log');
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'auto' });
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
    setIsDeploying(true);
    const env = envVars.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {});

    const toastId = toast.loading('Starting deployment protocol...');

    try {
      const res = await axios.post(`${API_BASE}/api/deploy`, {
        repoUrl, buildCmd, runCmd, envVars: env, proxy
      });
      toast.success('Sequence initiated', { id: toastId });
      setActiveBotId(res.data.id);
      fetchBots();
      setRepoUrl('');
    } catch (e) {
      toast.error('Deployment failed to initiate', { id: toastId });
    } finally {
      setIsDeploying(false);
    }
  };

  const stopBot = async (id) => {
    try {
      await axios.post(`${API_BASE}/api/stop/${id}`);
      toast.success('Process terminated');
      fetchBots();
    } catch (e) {
      toast.error('Failed to terminate process');
    }
  };

  const restartBot = async (id) => {
    const toastId = toast.loading('Rebooting system...');
    try {
      await axios.post(`${API_BASE}/api/restart/${id}`);
      toast.success('System rebooted', { id: toastId });
      fetchBots();
    } catch (e) {
      toast.error('Reboot failed', { id: toastId });
    }
  };

  const checkConnection = async () => {
    if (!repoUrl) {
      toast.error('Enter a host/IP in the Repo URL field to test probe');
      return;
    }

    const hostMatch = repoUrl.match(/([a-zA-Z0-9.-]+\.[a-z]{2,})/);
    const portMatch = repoUrl.match(/:(\d+)/);

    const host = hostMatch ? hostMatch[1] : null;
    const port = portMatch ? parseInt(portMatch[1]) : 25565;

    if (!host) {
      toast.error('Could not identify host in input');
      return;
    }

    setIsTesting(true);
    const toastId = toast.loading(`Probing ${host}:${port}...`);

    try {
      const res = await axios.post(`${API_BASE}/api/check-connection`, { host, port });
      if (res.data.success) {
        toast.success(res.data.message, { id: toastId, duration: 5000 });
      } else {
        toast.error(`Blocked: ${res.data.error}`, { id: toastId, duration: 6000 });
      }
    } catch (e) {
      toast.error('Diagnostic probe failed', { id: toastId });
    } finally {
      setIsTesting(false);
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index) => setEnvVars(envVars.filter((_, i) => i !== index));

  const stats = [
    { label: 'Active Instances', value: bots.filter(b => b.status === 'running').length, icon: <Activity size={16} /> },
    { label: 'Total Deployments', value: bots.length, icon: <Box size={16} /> },
    { label: 'Server Uptime', value: '99.9%', icon: <Server size={16} /> },
  ];

  return (
    <div className="app-container">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1c1c21', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      }} />

      <aside className="sidebar">
        <header style={{ marginBottom: '1rem' }}>
          <h1 className="title-gradient" style={{ fontSize: '1.75rem' }}>BotDeploy</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>v1.2.0 • PRO SYSTEM</p>
        </header>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Active Infrastructure</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bots.length === 0 && (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <Box size={32} />
                <p style={{ fontSize: '0.8125rem' }}>Node empty</p>
              </div>
            )}
            {bots.map(bot => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={bot.id}
                className={`glass-card bot-item ${activeBotId === bot.id ? 'active' : ''}`}
                style={{ padding: '1rem', cursor: 'pointer', background: activeBotId === bot.id ? 'rgba(139, 92, 246, 0.1)' : '' }}
                onClick={() => setActiveBotId(bot.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{bot.repoName}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', opacity: 0.7 }}>{bot.id.slice(0, 8)}</span>
                  </div>
                  <div className={`status-badge status-${bot.status}`} style={{ fontSize: '0.65rem' }}>{bot.status}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveBotId(null)}>
          <Plus size={18} /> Deploy New Node
        </button>
      </aside>

      <main className="main-content">
        <header className="stat-grid">
          {stats.map((stat, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} className="glass-card" style={{ padding: '1.25rem' }}
            >
              <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {stat.icon} {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</div>
            </motion.div>
          ))}
        </header>

        <section style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            {!activeBotId ? (
              <motion.div
                key="deploy-form"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="glass-card"
                style={{ padding: '2.5rem' }}
              >
                <div style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Initialize New Protocol</h2>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.9375rem' }}>Connect a public repository to spin up a new Node.js bot instance.</p>
                </div>

                <form onSubmit={handleDeploy} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label><Github size={14} style={{ marginBottom: '-2px' }} /> Repository URL</label>
                      <button
                        type="button"
                        className="btn"
                        onClick={checkConnection}
                        disabled={isTesting}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--border-active)' }}
                      >
                        {isTesting ? 'Probing...' : 'Test Connection'}
                      </button>
                    </div>
                    <input
                      placeholder="https://github.com/profile/repository"
                      value={repoUrl}
                      onChange={e => setRepoUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="input-group">
                      <label><Cpu size={14} style={{ marginBottom: '-2px' }} /> Build Script</label>
                      <input value={buildCmd} onChange={e => setBuildCmd(e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label><Rocket size={14} style={{ marginBottom: '-2px' }} /> Entry Command</label>
                      <input value={runCmd} onChange={e => setRunCmd(e.target.value)} required />
                    </div>
                  </div>

                  <div className="input-group">
                    <label><Globe size={14} style={{ marginBottom: '-2px' }} /> SOCKS5 Proxy (Optional)</label>
                    <input
                      placeholder="host:port or host:port:user:pass"
                      value={proxy}
                      onChange={e => setProxy(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label>Environment Matrix</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {envVars.map((env, i) => (
                        <div key={i} className="env-row" style={{ gap: '0.75rem' }}>
                          <input
                            placeholder="VARIABLE_KEY"
                            value={env.key}
                            onChange={e => {
                              const newVars = [...envVars];
                              newVars[i].key = e.target.value;
                              setEnvVars(newVars);
                            }}
                          />
                          <input
                            placeholder="value_string"
                            type="password"
                            value={env.value}
                            onChange={e => {
                              const newVars = [...envVars];
                              newVars[i].value = e.target.value;
                              setEnvVars(newVars);
                            }}
                          />
                          <button type="button" className="btn btn-secondary" onClick={() => removeEnvVar(i)} style={{ padding: '0.75rem' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn" onClick={addEnvVar} style={{ marginTop: '0.5rem', width: 'fit-content', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                      <Plus size={14} /> Add Parameter
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isDeploying}
                    style={{ marginTop: '1rem', width: '100%', height: '3.5rem', justifyContent: 'center', fontSize: '1.1rem' }}
                  >
                    {isDeploying ? 'Processing Protocol...' : <><Rocket size={20} /> Deploy Bot Instance</>}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="bot-details"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
              >
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                      <Box size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h2 style={{ fontSize: '1.75rem' }}>{bots.find(b => b.id === activeBotId)?.repoName}</h2>
                        <span className={`status-badge status-${bots.find(b => b.id === activeBotId)?.status}`}>
                          {bots.find(b => b.id === activeBotId)?.status}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>{bots.find(b => b.id === activeBotId)?.repoUrl}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => restartBot(activeBotId)}>
                      <RefreshCw size={18} /> Restart Instance
                    </button>
                    {bots.find(b => b.id === activeBotId)?.status === 'running' && (
                      <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => stopBot(activeBotId)}>
                        <StopCircle size={18} /> Stop Instance
                      </button>
                    )}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                    <TerminalIcon size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Live Terminal Stream</h3>
                    <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>CONNECTED • UTF-8</div>
                  </div>
                  <div className="terminal">
                    {(logs[activeBotId] || []).length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        Awaiting output stream...
                      </div>
                    )}
                    {(logs[activeBotId] || []).map((log, i) => (
                      <div key={i} className="log-line">
                        <span className="log-time">{log.timestamp}</span>
                        <span style={{ color: log.text.toLowerCase().includes('error') ? 'var(--error)' : 'inherit' }}>
                          {log.text}
                        </span>
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

export default App;
