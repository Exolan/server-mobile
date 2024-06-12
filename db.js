const mysql = require("mysql2");

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "556998",
  database: "app",
};

const connection = mysql.createConnection(dbConfig);

connection.connect((error) => {
  if (error) {
    console.log("Ошибка подключения к базе:", error);
    return;
  }
});

module.exports = connection;
