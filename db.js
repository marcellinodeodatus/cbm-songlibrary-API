const sql = require("mssql");

const config = {
  user: "usr_cbmsong",
  password: "J0hnTiga16%",
  server: "azsql-cbm01.database.windows.net",
  database: "SongLibraryDB",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to SQL Server");
    return pool;
  })
  .catch((err) => console.error("Database Connection Failed", err));

module.exports = {
  sql,
  poolPromise,
};
