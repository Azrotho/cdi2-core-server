import express, { type Express } from "express";
import { type RowDataPacket, type Pool } from "mysql2/promise";
import { getTokenOwner } from "./utils.js";


export function initTransactionRoutes(server: Express, database: Pool) {
    server.post("/transaction", express.json(), async (req, res) => {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        const { team_id, member_uuid, total_value, reason, quantity} = req.body;
        if (!team_id || !member_uuid || !total_value || !reason || !quantity) {
            return res.status(400).send({ error: "Missing required fields" });
        }

        try {
            await database.query(
                "INSERT INTO transaction (team_id, member_uuid, total_value, reason, quantity) VALUES (?, ?, ?, ?, ?)",
                [team_id, member_uuid, total_value, reason, quantity]
            );
            res.send({ message: "Transaction created successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to create transaction" });
        }
    });

    server.get("/transactions/:team_id", async (req, res) => {
        const team_id = req.params.team_id;
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT * FROM transaction WHERE team_id = ?",
                [team_id]
            );
            res.send({ transactions: rows });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to retrieve transactions" });
        }
    });
}