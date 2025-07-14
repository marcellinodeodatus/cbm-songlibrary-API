const express = require('express');
const app = express();
const songsRoute = require('./routes/songs');
const adminRoutes = require('./routes/admin');

app.use(express.json());
app.use('/api/songs', songsRoute);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
