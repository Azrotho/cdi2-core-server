import express, { type Express } from "express";
import { type RowDataPacket, type Pool } from "mysql2/promise";
import { isAdminToken, getTokenOwner } from "./utils.js";

export function initTeamRoutes(server: Express, database: Pool) {
    server.get("/teams", async (req, res) => {
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM team");
            res.send({ teams: rows });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });
    
    server.post("/teams", express.json(), async (req, res) => {
        const name = req.body.name;
        const tag = req.body.tag;
        const color = req.body.color;
        const leader = req.body.leader;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });
        if (!name || !tag || !color || !leader) return res.status(400).send({ error: "Missing required fields" });

        try {
            await database.query("INSERT INTO team (name, tag, color, leader, staff) VALUES (?, ?, ?, ?, 0)", [
                name,
                tag,
                color,
                leader
            ]);
            res.send({ message: "Team created successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to create team" });
        }
    });

    server.get("/teams/:id", async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM team WHERE id = ?", [id]);
            const team = rows[0];
            if (!team) return res.status(404).send({ error: "Team not found" });
            res.send({ team });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.get("/teams/:id/players", async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM player WHERE team = ?", [id]);
            res.send({ players: rows });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.delete("/teams/:id", async (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("DELETE FROM team WHERE id = ?", [id]);
            res.send({ message: "Team deleted successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to delete team" });
        }
    });

    server.get("/team/:team_id/money", async (req, res) => {
        const team_id = req.params.team_id;
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT SUM(total_value) as total_money FROM transaction WHERE team_id = ?",
                [team_id]
            );
            const total_money = rows[0]?.total_money || 0;
            res.send({ total_money });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to retrieve total money" });
        }
    });
}
