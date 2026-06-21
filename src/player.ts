import { type Express } from "express";
import { type RowDataPacket, type Pool } from "mysql2/promise";
import { getTokenOwner } from "./utils.js";

export function initPlayerRoutes(server: Express, database: Pool) {
    server.get("/players/discord/:discordId", async (req, res) => {
        const discordId = req.params.discordId;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin" && owner !== discordId) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT uuid, name, discord_id, team FROM player WHERE discord_id = ?",
                [discordId]
            );
            const player = rows[0];
            if (!player) {
                return res.status(404).send({ error: "Player not found" });
            }
            res.send({ player });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.get("/players/:uuid", async (req, res) => {
        const uuid = req.params.uuid;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin" && owner !== uuid) return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT uuid, name, discord_id, team FROM player WHERE uuid = ?",
                [uuid]
            );
            const player = rows[0];
            if (!player) {
                return res.status(404).send({ error: "Player not found" });
            }
            res.send({ player });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.post("/players/:uuid/team", async (req, res) => {
        const uuid = req.params.uuid;
        const { team } = req.body;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("UPDATE player SET team = ? WHERE uuid = ?", [team, uuid]);
            res.send({ message: "Player team updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.post("/players/:uuid/name", async (req, res) => {
        const uuid = req.params.uuid;
        const { name } = req.body;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("UPDATE player SET name = ? WHERE uuid = ?", [name, uuid]);
            res.send({ message: "Player name updated successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.delete("/players/:uuid", async (req, res) => {
        const uuid = req.params.uuid;
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            await database.query("DELETE FROM player WHERE uuid = ?", [uuid]);
            res.send({ message: "Player deleted successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.get("/players", async (req, res) => {
        const token = req.headers["authorization"];

        if (!token) return res.status(401).send({ error: "No token provided" });
        const owner = await getTokenOwner(token, database);
        if (!owner) return res.status(401).send({ error: "Invalid token" });
        if (owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

        try {
            const [rows] = await database.query<RowDataPacket[]>("SELECT uuid, name, discord_id, team FROM player");
            res.send({ players: rows });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });
}
