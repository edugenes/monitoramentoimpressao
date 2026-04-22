require('dotenv').config();
process.env.TZ = process.env.TZ || 'America/Recife';

process.on('uncaughtException', (err) => {
  console.error('[ERRO] Exceção não tratada (servidor continua):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[ERRO] Promise rejeitada (servidor continua):', reason);
});
const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authenticate, requireAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const printerRoutes = require('./routes/printerRoutes');
const sectorRoutes = require('./routes/sectorRoutes');
const quotaRoutes = require('./routes/quotaRoutes');
const releaseRoutes = require('./routes/releaseRoutes');
const usageRoutes = require('./routes/usageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const snmpRoutes = require('./routes/snmpRoutes');
const alertRoutes = require('./routes/alertRoutes');
const scheduler = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use('/api/printers', authenticate, printerRoutes);
app.use('/api/sectors', authenticate, sectorRoutes);
app.use('/api/quotas', authenticate, quotaRoutes);
app.use('/api/releases', authenticate, releaseRoutes);
app.use('/api/usage', authenticate, usageRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/snmp', authenticate, snmpRoutes);
app.use('/api/alerts', authenticate, alertRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em 0.0.0.0:${PORT}`);
  scheduler.start();
});
