require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const schoolAdminRoutes = require('./routes/schoolAdminRoutes');
const platformAdminRoutes = require('./routes/platformAdminRoutes');
const academicRoutes = require('./routes/academicRoutes');
const studentToolsRoutes = require('./routes/studentToolsRoutes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'IMBONI Education Hub API' }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', schoolAdminRoutes);
app.use('/api/platform', platformAdminRoutes);
app.use('/api', academicRoutes);       // courses, teams, resources, assignments, quizzes, sessions, forum
app.use('/api', studentToolsRoutes);   // kanban + ai tutor

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// Centralized error handler (e.g. Multer file-size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`IMBONI Education Hub API running on port ${PORT}`));
