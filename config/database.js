const { Sequelize } = require("sequelize");
const pg = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL is missing. Add it to the .env file."
    );
}

const sequelize = new Sequelize(connectionString, {
    dialect: "postgres",
    dialectModule: pg,
    logging: false,

    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },

    pool: {
        max: 3,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

module.exports = sequelize;