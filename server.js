const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { connectPostgres } = require('./config/pgDb');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const ragRoutes = require('./routes/ragRoutes');
const orderRoutes = require('./routes/orderRoutes');
const okfRoutes = require('./routes/okfRoutes');
const { backfillMissingEmbeddings } = require('./utils/embeddingSync');
const { rebuildFullOkfBundle } = require('./utils/okfGenerator');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/okf', express.static('okf')); // OKF bundle publicly readable — koi bhi agent/tool seedha /okf se padh sakta hai

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/okf', okfRoutes);

const PORT = process.env.PORT || 5000;

connectPostgres().then(() => {
  backfillMissingEmbeddings();
  rebuildFullOkfBundle();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
