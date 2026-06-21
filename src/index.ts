import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import { initTeamRoutes } from "./team.js";
import { initPlayerRoutes } from "./player.js";
import { initVerificationRoutes } from "./verification.js";
import { initTokenRoutes } from "./token.js";
import { initTransactionRoutes } from "./transaction.js";

dotenv.config({ quiet: true });

const server = express();

const database = mysql.createPool({
    host: process.env.DATABASE_HOSTNAME ?? "localhost",
    port: parseInt(process.env.DATABASE_PORT ?? "3306"),
    user: process.env.DATABASE_USERNAME ?? "root",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "cdi2"
});

initTeamRoutes(server, database);
initPlayerRoutes(server, database);
initVerificationRoutes(server, database);
initTokenRoutes(server, database);
initTransactionRoutes(server, database);

server.get("/ping", (req, res) => {
    res.send({ message: "pong!" });
});

server.get("/quoi", (req, res) => {
    res.send({ message: "feur" });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
