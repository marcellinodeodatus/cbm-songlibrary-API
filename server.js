const express = require("express");
const app = express();
const songsRoute = require("./routes/songs");
const adminRoutes = require("./routes/admin");
const cors = require("cors");

let allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:3001",
  "https://icy-ground-04cbd900f.4.azurestaticapps.net",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
  })
);

app.use(express.json());
app.use("/api/songs", songsRoute);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
