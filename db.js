const mysql = require('mysql2/promise'); 
require('dotenv').config();

const pool = mysql.createPool({ 
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 3306, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Conectado a la base de datos MySQL.'); 
        const [rows, fields] = await connection.query('SELECT NOW()');
        
    } catch (err) {
       
        console.error('Error conectando o probando la base de datos MySQL:', err);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

testConnection();

module.exports = pool;