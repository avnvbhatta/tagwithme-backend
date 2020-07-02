
require('dotenv').config()
const Pool = require('pg').Pool
//Environment variables for db connection
const pool = new Pool({
  user:  process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password:  process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

module.exports = { pool }