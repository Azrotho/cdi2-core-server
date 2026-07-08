import express, { type Express } from "express";
import { type RowDataPacket, type ResultSetHeader, type Pool } from "mysql2/promise";
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
        const tag = req.body.tag ? String(req.body.tag).toUpperCase() : undefined;
        const color = req.body.color;
        const leader = req.body.leader;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });
        if (!name || !tag || !color || !leader) return res.status(400).send({ error: "Missing required fields" });

        // Vérifier que le tag est unique
        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM team WHERE tag = ?", [tag]);
            if (rows.length > 0) {
                return res.status(400).send({ error: "Tag already exists" });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).send({ error: "Internal server error" });
        }

        try {
            const [result] = await database.query<ResultSetHeader>("INSERT INTO team (name, tag, color, leader, staff) VALUES (?, ?, ?, ?, 0)", [
                name,
                tag,
                color,
                leader
            ]);
            res.send({ message: "Team created successfully", id: result.insertId });
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

    server.post("/teams/:id/color", express.json(), async (req, res) => {
        const id = parseInt(req.params.id);
        const color = req.body.color;
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        if (!color) return res.status(400).send({ error: "Missing color field" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("UPDATE team SET color = ? WHERE id = ?", [color, id]);
            res.send({ message: "Team color updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to update team color" });
        }
    });

    server.post("/teams/:id/leader", express.json(), async (req, res) => {
        const id = parseInt(req.params.id);
        const leader = req.body.leader;
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        if (!leader) return res.status(400).send({ error: "Missing leader field" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        // Vérifier que le leader existe dans la table player
        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM player WHERE uuid = ?", [leader]);
            if (rows.length === 0) {
                return res.status(400).send({ error: "Leader does not exist" });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).send({ error: "Internal server error" });
        }

        // Vérifier que le leader est membre de l'équipe
        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM player WHERE uuid = ? AND team = ?", [leader, id]);
            if (rows.length === 0) {
                return res.status(400).send({ error: "Leader is not a member of the team" });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).send({ error: "Internal server error" });
        }

        try {
            await database.query("UPDATE team SET leader = ? WHERE id = ?", [leader, id]);
            res.send({ message: "Team leader updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to update team leader" });
        }
    });


    server.post("/teams/:id/tag", express.json(), async (req, res) => {
        const id = parseInt(req.params.id);
        const tag = req.body.tag ? String(req.body.tag).toUpperCase() : undefined;
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        if (!tag) return res.status(400).send({ error: "Missing tag field" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        // Vérifier que le tag est unique
        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM team WHERE tag = ?", [tag]);
            if (rows.length > 0) {
                return res.status(400).send({ error: "Tag already exists" });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).send({ error: "Internal server error" });
        }

        try {
            await database.query("UPDATE team SET tag = ? WHERE id = ?", [tag, id]);
            res.send({ message: "Team tag updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to update team tag" });
        }
    });

    server.post("/teams/:id/name", express.json(), async (req, res) => {
        const id = parseInt(req.params.id);
        const name = req.body.name;
        if (isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
        if (!name) return res.status(400).send({ error: "Missing name field" });
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("UPDATE team SET name = ? WHERE id = ?", [name, id]);
            res.send({ message: "Team name updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to update team name" });
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

    server.post("/team/:team_id/verify", express.json(), async (req, res) => {
        const team_id = req.params.team_id;
        const token = req.headers["authorization"];
        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("UPDATE team SET verification = 1 WHERE id = ?", [team_id]);
            res.send({ message: "Team verified successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Failed to verify team" });
        }
    });
}
