const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/auth.js");
const { poolPromise, sql } = require("../db.js");

// --------------- GET ------------------ //
// Get all songs
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT * FROM Songs ORDER BY title");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all worship leaders
router.get("/worship-leaders", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT leader_id, name FROM WorshipLeaders ORDER BY name");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent songs for all leaders (no leader specified)
router.get("/recent", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 10 s.title, FORMAT(srv.service_date, 'yyyy-MM-dd') AS service_date, ss.key_used, wl.name AS leader
      FROM ServiceSongs ss
      JOIN Songs s ON ss.song_id = s.song_id
      JOIN SundayServices srv ON ss.service_id = srv.service_id
      JOIN WorshipLeaders wl ON ss.leader_id = wl.leader_id
      ORDER BY srv.service_date DESC, ss.order_number
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent songs by leader
router.get("/recent/:leader", async (req, res) => {
  const leader = req.params.leader;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("leader", sql.NVarChar, leader)
      .query(`
        SELECT TOP 10 s.title, FORMAT(srv.service_date, 'yyyy-MM-dd') AS service_date, ss.key_used
        FROM ServiceSongs ss
        JOIN Songs s ON ss.song_id = s.song_id
        JOIN SundayServices srv ON ss.service_id = srv.service_id
        JOIN WorshipLeaders wl ON ss.leader_id = wl.leader_id
        WHERE wl.name = @leader
        ORDER BY srv.service_date DESC, ss.order_number
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Most played songs
router.get("/most-played", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 10 s.title, COUNT(*) AS times_played
      FROM ServiceSongs ss
      JOIN Songs s ON ss.song_id = s.song_id
      GROUP BY s.title
      ORDER BY times_played DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// most played songs by a specific worship leader
router.get("/most-played/:leader", async (req, res) => {
  const leader = req.params.leader;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("leader", sql.NVarChar, leader)
      .query(`
        SELECT TOP 10 s.title, COUNT(*) AS times_played
        FROM ServiceSongs ss
        JOIN Songs s ON ss.song_id = s.song_id
        JOIN WorshipLeaders wl ON ss.leader_id = wl.leader_id
        WHERE wl.name = @leader
        GROUP BY s.title
        ORDER BY times_played DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preferred keys for all leaders (no leader specified)
router.get("/preferred-keys", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT s.title, lpk.preferred_key, wl.name AS leader
      FROM LeaderPreferredKeys lpk
      JOIN Songs s ON lpk.song_id = s.song_id
      JOIN WorshipLeaders wl ON lpk.leader_id = wl.leader_id

      UNION

      SELECT lnt.song_title AS title, lnt.preferred_key, wl.name AS leader
      FROM LeaderNoTrackSongs_PreferredKeys lnt
      JOIN WorshipLeaders wl ON lnt.leader_id = wl.leader_id

      ORDER BY leader, title
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Worship Leader's preferred keys
router.get("/preferred-keys/:leader", async (req, res) => {
  const leader = req.params.leader;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("leader", sql.NVarChar, leader)
      .query(`
        SELECT s.title, lpk.preferred_key, lpk.leader_id, lpk.song_id, NULL AS song_title
        FROM LeaderPreferredKeys lpk
        JOIN Songs s ON lpk.song_id = s.song_id
        JOIN WorshipLeaders wl ON lpk.leader_id = wl.leader_id
        WHERE wl.name = @leader

        UNION

        SELECT lnt.song_title AS title, lnt.preferred_key, lnt.leader_id, NULL AS song_id, lnt.song_title
        FROM LeaderNoTrackSongs_PreferredKeys lnt
        JOIN WorshipLeaders wl ON lnt.leader_id = wl.leader_id
        WHERE wl.name = @leader

        ORDER BY title;
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// show all songs with their artists
router.get("/songs-with-artists", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT s.song_id, s.title, a.name AS artist_name
      FROM Songs s
      LEFT JOIN SongArtists sa ON s.song_id = sa.song_id
      LEFT JOIN Artists a ON sa.artist_id = a.artist_id
      ORDER BY s.title, artist_name
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// endpoint to Get Artists
router.get("/artists", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT artist_id, name FROM Artists ORDER BY name");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new Sunday Service
router.post("/services", adminAuth, async (req, res) => {
  const { service_date } = req.body;
  if (!service_date) {
    return res.status(400).json({ error: "Service date is required." });
  }
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("service_date", sql.Date, service_date)
      .query(
        "INSERT INTO SundayServices (service_date) OUTPUT INSERTED.service_id VALUES (@service_date)"
      );
    res.json({ service_id: result.recordset[0].service_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add songs to a Sunday Service
router.post("/services/:service_id/songs", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  const { leader_id, song_id, key_used, order_number } = req.body;
  if (
    !service_id ||
    !leader_id ||
    !song_id ||
    !key_used ||
    order_number == null
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .input("key_used", sql.NVarChar(10), key_used)
      .input("order_number", sql.Int, order_number)
      .query(
        `INSERT INTO ServiceSongs (service_id, leader_id, song_id, key_used, order_number)
         VALUES (@service_id, @leader_id, @song_id, @key_used, @order_number)`
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a Sunday Service date
router.put("/services/:service_id", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  const { service_date } = req.body;
  if (!service_date) {
    return res.status(400).json({ error: "Service date is required." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .input("service_date", sql.Date, service_date)
      .query(
        "UPDATE SundayServices SET service_date = @service_date WHERE service_id = @service_id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a Sunday Service and its songs
router.delete("/services/:service_id", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  try {
    const pool = await poolPromise;
    // Delete related ServiceSongs first
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .query("DELETE FROM ServiceSongs WHERE service_id = @service_id");
    // Then delete the service itself
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .query("DELETE FROM SundayServices WHERE service_id = @service_id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a Service Song (key_used, order_number, leader)
router.put("/services/:service_id/songs", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  const { leader_id, song_id, key_used, order_number } = req.body;
  if (!service_id || !leader_id || !song_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .input("key_used", sql.NVarChar(10), key_used)
      .input("order_number", sql.Int, order_number)
      .query(
        `UPDATE ServiceSongs
         SET key_used = @key_used, order_number = @order_number, leader_id = @leader_id
         WHERE service_id = @service_id AND song_id = @song_id`
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a Service Song from a Sunday Service
router.delete("/services/:service_id/songs", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  const { leader_id, song_id } = req.body;
  if (!service_id || !leader_id || !song_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .query(
        `DELETE FROM ServiceSongs
         WHERE service_id = @service_id AND leader_id = @leader_id AND song_id = @song_id`
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all songs for a Sunday Service
router.get("/services/:service_id/songs", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("service_id", sql.Int, service_id)
      .query(`
        SELECT ss.*, s.title, l.name as leader_name
        FROM ServiceSongs ss
        JOIN Songs s ON ss.song_id = s.song_id
        JOIN WorshipLeaders l ON ss.leader_id = l.leader_id
        WHERE ss.service_id = @service_id
        ORDER BY ss.order_number
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update worship leader for a Sunday Service
router.put("/services/:service_id/leader", adminAuth, async (req, res) => {
  const { service_id } = req.params;
  const { leader_id } = req.body;
  if (!leader_id) {
    return res.status(400).json({ error: "Leader ID is required." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("service_id", sql.Int, service_id)
      .input("leader_id", sql.Int, leader_id)
      .query(
        "UPDATE SundayServices SET worship_leader_id = @leader_id WHERE service_id = @service_id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update leader for all songs in a Sunday Service
router.put(
  "/services/:service_id/songs/bulk-leader",
  adminAuth,
  async (req, res) => {
    const { service_id } = req.params;
    const { leader_id } = req.body;
    if (!leader_id) {
      return res.status(400).json({ error: "Leader ID is required." });
    }
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("service_id", sql.Int, service_id)
        .input("leader_id", sql.Int, leader_id)
        .query(
          "UPDATE ServiceSongs SET leader_id = @leader_id WHERE service_id = @service_id"
        );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// endpoint to Get Songs with their Worship Leaders and Service Dates
router.get("/services-with-songs", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        srv.service_id,
        FORMAT(srv.service_date, 'yyyy-MM-dd') AS service_date,
        wl.name AS worship_leader,
        s.title AS song_title,
        ss.key_used,
        ss.order_number,
        sl.name AS service_worship_leader -- <--- add this line
      FROM SundayServices srv
      LEFT JOIN ServiceSongs ss ON srv.service_id = ss.service_id
      LEFT JOIN Songs s ON ss.song_id = s.song_id
      LEFT JOIN WorshipLeaders wl ON ss.leader_id = wl.leader_id
      LEFT JOIN WorshipLeaders sl ON srv.worship_leader_id = sl.leader_id
      ORDER BY srv.service_date DESC, ss.order_number
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------- POST ------------------ //
// Add a new artist
router.post("/artists", adminAuth, async (req, res) => {
  const { name } = req.body;
  try {
    const pool = await poolPromise;
    // Insert artist and return new artist_id
    const result = await pool
      .request()
      .input("name", sql.NVarChar, name)
      .query(
        "INSERT INTO Artists (name) OUTPUT INSERTED.artist_id VALUES (@name)"
      );
    res.json({ artist_id: result.recordset[0].artist_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check for duplicate song
router.post("/check-duplicate", async (req, res) => {
  const { title, artist_id } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("title", sql.NVarChar, title)
      .input("artist_id", sql.Int, artist_id).query(`
        SELECT s.song_id
        FROM Songs s
        JOIN SongArtists sa ON s.song_id = sa.song_id
        WHERE s.title = @title AND sa.artist_id = @artist_id
      `);
    res.json({ exists: result.recordset.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new song
router.post("/", adminAuth, async (req, res) => {
  const { title, artist_id } = req.body;
  try {
    const pool = await poolPromise;
    // Insert song
    const songResult = await pool
      .request()
      .input("title", sql.NVarChar, title)
      .query(
        "INSERT INTO Songs (title) OUTPUT INSERTED.song_id VALUES (@title)"
      );
    const song_id = songResult.recordset[0].song_id;
    // Link song to artist
    await pool
      .request()
      .input("song_id", sql.Int, song_id)
      .input("artist_id", sql.Int, artist_id)
      .query(
        "INSERT INTO SongArtists (song_id, artist_id) VALUES (@song_id, @artist_id)"
      );
    res.json({ song_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a song
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    const songId = req.params.id;

    // Delete related records in SongArtists first
    await pool
      .request()
      .input("song_id", sql.Int, songId)
      .query("DELETE FROM SongArtists WHERE song_id = @song_id");

    // Now delete the song itself
    await pool
      .request()
      .input("id", sql.Int, songId)
      .query("DELETE FROM Songs WHERE song_id = @id");

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Edit a song
router.put("/:id", adminAuth, async (req, res) => {
  const { title, artist_id } = req.body;
  const song_id = req.params.id;
  try {
    const pool = await poolPromise;
    // Update song title
    await pool
      .request()
      .input("id", sql.Int, song_id)
      .input("title", sql.NVarChar, title)
      .query("UPDATE Songs SET title = @title WHERE song_id = @id");
    // Update artist in SongArtists
    await pool
      .request()
      .input("song_id", sql.Int, song_id)
      .input("artist_id", sql.Int, artist_id)
      .query(
        "UPDATE SongArtists SET artist_id = @artist_id WHERE song_id = @song_id"
      );
    res.json({ success: true });
  } catch (err) {
    console.error(err); // Add this for debugging
    res.status(500).json({ error: err.message });
  }
});

// Edit artist
router.put("/artists/:id", adminAuth, async (req, res) => {
  const { name } = req.body;
  const artist_id = req.params.id;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, artist_id)
      .input("name", sql.NVarChar, name)
      .query("UPDATE Artists SET name = @name WHERE artist_id = @id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit worship leader name
router.put("/worship-leaders/:leader_id", adminAuth, async (req, res) => {
  const { leader_id } = req.params;
  const { name } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("leader_id", sql.Int, leader_id)
      .query(
        "UPDATE WorshipLeaders SET name = @name WHERE leader_id = @leader_id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete artist (safe)
router.delete("/artists/:id", adminAuth, async (req, res) => {
  const artist_id = req.params.id;
  try {
    const pool = await poolPromise;
    // Check if artist is linked to any songs
    const result = await pool
      .request()
      .input("artist_id", sql.Int, artist_id)
      .query(
        "SELECT COUNT(*) AS count FROM SongArtists WHERE artist_id = @artist_id"
      );
    if (result.recordset[0].count > 0) {
      return res.status(400).json({
        error: "Cannot delete: Artist is linked to one or more songs.",
      });
    }
    // Safe to delete
    await pool
      .request()
      .input("id", sql.Int, artist_id)
      .query("DELETE FROM Artists WHERE artist_id = @id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete worship leader
router.delete("/worship-leaders/:leader_id", adminAuth, async (req, res) => {
  const { leader_id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .query("DELETE FROM WorshipLeaders WHERE leader_id = @leader_id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add preferred key
router.post("/preferred-keys", adminAuth, async (req, res) => {
  const { leader_id, song_id, preferred_key } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .input("preferred_key", sql.NVarChar(10), preferred_key)
      .query(
        "INSERT INTO LeaderPreferredKeys (leader_id, song_id, preferred_key) VALUES (@leader_id, @song_id, @preferred_key)"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new worship leader
router.post("/worship-leaders", adminAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name.trim())
      .query(
        "INSERT INTO WorshipLeaders (name) OUTPUT INSERTED.leader_id VALUES (@name)"
      );
    res.json({ leader_id: result.recordset[0].leader_id, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit preferred key for tracked songs (LeaderPreferredKeys)
router.put("/preferred-keys/track", adminAuth, async (req, res) => {
  const { leader_id, song_id, preferred_key } = req.body;
  if (!leader_id || !song_id || !preferred_key) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .input("preferred_key", sql.NVarChar(10), preferred_key)
      .query(
        "UPDATE LeaderPreferredKeys SET preferred_key = @preferred_key WHERE leader_id = @leader_id AND song_id = @song_id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit preferred key for untracked songs (LeaderNoTrackSongs_PreferredKeys)
router.put("/preferred-keys/notrack", adminAuth, async (req, res) => {
  const { leader_id, song_title, preferred_key } = req.body;
  if (!leader_id || !song_title || !preferred_key) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_title", sql.NVarChar(255), song_title)
      .input("preferred_key", sql.NVarChar(10), preferred_key)
      .query(
        "UPDATE LeaderNoTrackSongs_PreferredKeys SET preferred_key = @preferred_key WHERE leader_id = @leader_id AND song_title = @song_title"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete preferred key for tracked songs
router.delete("/preferred-keys/track", adminAuth, async (req, res) => {
  const { leader_id, song_id } = req.body;
  if (!leader_id || !song_id) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_id", sql.Int, song_id)
      .query(
        "DELETE FROM LeaderPreferredKeys WHERE leader_id = @leader_id AND song_id = @song_id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add preferred key for no-track songs
router.post("/preferred-keys/notrack", adminAuth, async (req, res) => {
  const { leader_id, song_title, preferred_key } = req.body;
  if (!leader_id || !song_title || !preferred_key) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_title", sql.NVarChar(255), song_title)
      .input("preferred_key", sql.NVarChar(10), preferred_key)
      .query(
        "INSERT INTO LeaderNoTrackSongs_PreferredKeys (leader_id, song_title, preferred_key) VALUES (@leader_id, @song_title, @preferred_key)"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete preferred key for untracked songs
router.delete("/preferred-keys/notrack", adminAuth, async (req, res) => {
  const { leader_id, song_title } = req.body;
  if (!leader_id || !song_title) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("leader_id", sql.Int, leader_id)
      .input("song_title", sql.NVarChar(255), song_title)
      .query(
        "DELETE FROM LeaderNoTrackSongs_PreferredKeys WHERE leader_id = @leader_id AND song_title = @song_title"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit preferred key
router.put("/preferred-keys/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { preferred_key } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("preferred_key", sql.NVarChar(10), preferred_key)
      .query(
        "UPDATE LeaderPreferredKeys SET preferred_key = @preferred_key WHERE id = @id"
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete preferred key
router.delete("/preferred-keys/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM LeaderPreferredKeys WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
