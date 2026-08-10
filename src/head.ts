import express, { type Express } from "express";
import { type RowDataPacket, type ResultSetHeader, type Pool } from "mysql2/promise";
import { isAdminToken } from "./utils.js";

export function initHeadRoutes(server: Express, database: Pool) {
    server.post("/heads", express.json(), async (req, res) => {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        const { team, x, y, z } = req.body;
        if (team === undefined || x === undefined || y === undefined || z === undefined) {
            return res.status(400).send({ error: "Missing required fields (team, x, y, z)" });
        }

        try {
            const [existing] = await database.query<RowDataPacket[]>(
                "SELECT * FROM head WHERE team = ? AND x = ? AND y = ? AND z = ?",
                [team, x, y, z]
            );

            if (existing.length > 0) {
                return res.status(409).send({ error: "Head already found by this team", alreadyFound: true });
            }

            const [result] = await database.query<ResultSetHeader>(
                "INSERT INTO head (team, x, y, z) VALUES (?, ?, ?, ?)",
                [team, x, y, z]
            );

            res.send({ message: "Head added successfully", id: result.insertId });
        } catch (err) {
            console.error("Erreur lors de l'enregistrement de la tête:", err);
            res.status(500).send({ error: "Failed to add head" });
        }
    });

    server.get("/heads/team/:team_id", async (req, res) => {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        const teamId = parseInt(req.params.team_id);
        if (isNaN(teamId)) {
            return res.status(400).send({ error: "Invalid team ID" });
        }

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT * FROM head WHERE team = ?",
                [teamId]
            );
            res.send({ heads: rows });
        } catch (err) {
            console.error("Erreur lors de la récupération des têtes:", err);
            res.status(500).send({ error: "Failed to retrieve heads" });
        }
    });

    server.get("/heads/counts", async (req, res) => {
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT team, COUNT(*) as count FROM head GROUP BY team"
            );
            res.send({ counts: rows });
        } catch (err) {
            console.error("Erreur lors de la récupération du classement des têtes:", err);
            res.status(500).send({ error: "Failed to retrieve head counts" });
        }
    });
}
