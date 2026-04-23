import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import workspacesRoutes from './routes/workspaces.js';
import departmentsRoutes from './routes/departments.js';
import groupsRoutes from './routes/groups.js';
import boardsRoutes from './routes/boards.js';
import tasksRoutes from './routes/tasks.js';
import documentsRoutes from './routes/documents.js';
import notificationsRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
