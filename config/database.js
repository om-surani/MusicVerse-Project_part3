// config/database.js
// WEB700 Project Part 3 - Phase 0/1
// Sequelize connection to a Neon (managed Postgres) database.
//
// The connection string is read from the DATABASE_URL environment
// variable so real credentials never get committed to the repo
// (see .env.example for the expected format, and .gitignore for .env).
//
// Neon requires SSL, so we always enable it here.

require("dotenv").config();
const { Sequelize } = require("sequelize");

if (!process.env.DATABASE_URL) {
  // Don't throw here - this file is required by scripts/routes at startup,
  // and we still want helpful console output instead of a silent crash.
  console.warn(
    "[config/database] DATABASE_URL is not set. Copy .env.example to .env " +
      "and fill in your Neon connection string before running the app or " +
      "the migration script."
  );
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: false, // set to console.log to see generated SQL while debugging
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // required for Neon's pooled connection string
    },
  },
});

module.exports = sequelize;
