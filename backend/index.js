const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Serve index.html for any other requests (SPA support)
// We use a middleware here to avoid path-to-regexp version compatibility issues
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
const DEPLOY_DIR = path.join(__dirname, 'deployments');

if (!fs.existsSync(DEPLOY_DIR)) {
    fs.mkdirSync(DEPLOY_DIR);
}

const processes = new Map();

// Helper to sanitize folder names
const sanitize = (name) => name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

app.post('/api/deploy', async (req, res) => {
    const { repoUrl, buildCmd, runCmd, envVars, proxy } = req.body;
    const id = uuidv4();
    const repoName = repoUrl.split('/').pop().replace('.git', '');
    const deployPath = path.join(DEPLOY_DIR, `${sanitize(repoName)}_${id}`);

    try {
        res.status(202).json({ id, status: 'cloning', message: 'Deployment started' });

        io.emit('log', { id, text: `Cloning ${repoUrl}...` });
        await simpleGit().clone(repoUrl, deployPath);
        io.emit('log', { id, text: 'Clone complete.' });

        // Build process
        if (buildCmd) {
            io.emit('log', { id, text: `Running build: ${buildCmd}` });
            const build = spawn(buildCmd, { shell: true, cwd: deployPath });
            build.stdout.on('data', (data) => io.emit('log', { id, text: data.toString() }));
            build.stderr.on('data', (data) => io.emit('log', { id, text: data.toString() }));
            await new Promise((resolve) => build.on('close', resolve));
        }

        io.emit('log', { id, text: `Starting bot: ${runCmd}` });

        // Avoid port conflict on Render/hosting services
        const botEnv = { ...process.env, ...envVars };
        if (!envVars.PORT) {
            botEnv.PORT = Math.floor(Math.random() * (65535 - 10000) + 10000);
        }

        // Inject proxy if provided
        if (proxy) {
            botEnv.SOCKS_PROXY = proxy;
            io.emit('log', { id, text: `Routing through proxy: ${proxy.split('@').pop()}` });
        }

        const botProcess = spawn(runCmd, {
            shell: true,
            cwd: deployPath,
            env: botEnv
        });

        processes.set(id, {
            process: botProcess,
            status: 'running',
            repoUrl,
            deployPath,
            repoName,
            runCmd,
            buildCmd,
            env: botEnv
        });

        botProcess.stdout.on('data', (data) => io.emit('log', { id, text: data.toString() }));
        botProcess.stderr.on('data', (data) => io.emit('log', { id, text: data.toString() }));

        botProcess.on('close', (code) => {
            io.emit('log', { id, text: `Process exited with code ${code}` });
            if (processes.has(id)) {
                processes.get(id).status = 'stopped';
            }
        });

    } catch (error) {
        console.error(error);
        io.emit('log', { id, text: `Error: ${error.message}` });
    }
});

app.get('/api/bots', (req, res) => {
    const bots = Array.from(processes.entries()).map(([id, data]) => ({
        id,
        repoName: data.repoName,
        status: data.status,
        repoUrl: data.repoUrl
    }));
    res.json(bots);
});

app.post('/api/stop/:id', (req, res) => {
    const { id } = req.params;
    const botData = processes.get(id);
    if (botData && botData.process) {
        botData.process.kill();
        botData.status = 'stopped';
        res.json({ message: 'Bot stopped' });
    } else {
        res.status(404).json({ error: 'Bot not found' });
    }
});

app.post('/api/restart/:id', async (req, res) => {
    const { id } = req.params;
    const botData = processes.get(id);

    if (!botData) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    try {
        // Kill existing process if running
        if (botData.process) {
            botData.process.kill();
        }

        io.emit('log', { id, text: '--- RESTART INITIATED ---' });

        const botProcess = spawn(botData.runCmd, {
            shell: true,
            cwd: botData.deployPath,
            env: botData.env
        });

        botData.process = botProcess;
        botData.status = 'running';

        botProcess.stdout.on('data', (data) => io.emit('log', { id, text: data.toString() }));
        botProcess.stderr.on('data', (data) => io.emit('log', { id, text: data.toString() }));

        botProcess.on('close', (code) => {
            io.emit('log', { id, text: `Process exited with code ${code}` });
            if (processes.has(id)) {
                processes.get(id).status = 'stopped';
            }
        });

        res.json({ message: 'Restarted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

server.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});

app.post('/api/check-connection', (req, res) => {
    const { host, port } = req.body;
    if (!host || !port) return res.status(400).json({ error: 'Host and port required' });

    const net = require('net');
    const socket = new net.Socket();

    socket.setTimeout(5000);

    socket.on('connect', () => {
        socket.destroy();
        res.json({ success: true, message: `Successfully connected to ${host}:${port}` });
    });

    socket.on('timeout', () => {
        socket.destroy();
        res.json({ success: false, error: 'Connection timed out' });
    });

    socket.on('error', (err) => {
        socket.destroy();
        res.json({ success: false, error: err.message });
    });

    socket.connect(port, host);
});
