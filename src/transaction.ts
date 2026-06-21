import express, { type Express } from "express";
import { type Pool } from "mysql2/promise";
import { getTokenOwner, pass, isAdminToken } from "./utils.js";


export function initTransactionRoutes(server: Express, database: Pool) {
    server.post("/transaction", express.json(), async (req, res) => {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
    });
}