import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import http from 'http';
import { getUploadsPath } from './uploadsPath';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspaces';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import groupRoutes from './routes/groups';
import documentRoutes from './routes/documents';
import notificationRoutes from './routes/notifications';
import workspaceChatRoutes from './routes/workspaceChats';
import calendarEventRoutes from './routes/calendarEvents';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 5004;

const uploadDir = getUploadsPath();
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/workspace-chats', workspaceChatRoutes);
app.use('/api/calendar-events', calendarEventRoutes);

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

export const broadcast = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
};

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
