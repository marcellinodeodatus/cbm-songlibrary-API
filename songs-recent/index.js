const sql = require("mssql");

module.exports = async function (context, req) {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      options: { encrypt: true },
    });

    const result = await pool.request().query(`
      SELECT TOP 10 s.title, FORMAT(srv.service_date, 'yyyy-MM-dd') AS service_date, ss.key_used, wl.name AS leader
      FROM ServiceSongs ss
      JOIN Songs s ON ss.song_id = s.song_id
      JOIN SundayServices srv ON ss.service_id = srv.service_id
      JOIN WorshipLeaders wl ON ss.leader_id = wl.leader_id
      ORDER BY srv.service_date DESC, ss.order_number
    `);

    context.res = {
      status: 200,
      body: result.recordset,
    };
  } catch (err) {
    context.res = {
      status: 500,
      body: { error: err.message },
    };
  }
};
