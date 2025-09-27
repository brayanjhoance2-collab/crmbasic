/** 
import mysql from 'mysql2/promise';
const db = mysql.createPool({
  host: 'localhost',      // Host local
  port: 3306,             // Puerto predeterminado de MySQL
  user: 'root',         // Tu usuario
  password: '123456',  // Reemplaza con tu contraseña real
  database: 'crm_whatsapp_instagram_facebook',   // Nombre de la base de datos
});

export default db;

*/
/**/
// lib/db.ts o lib/database.ts
import mysql from 'mysql2/promise';
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
export default db;

// cd 'C:\Program Files\MySQL\MySQL Server 9.0\bin\'
// cd C:\Program Files\MySQL\MySQL Server 9.0\bin
//.\mysql -u brayan -p