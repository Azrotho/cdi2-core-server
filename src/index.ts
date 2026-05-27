import dotenv from "dotenv";
import express from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

dotenv.config({ quiet: true });

const server = express();

const database = mysql.createPool({
    host: process.env.DATABASE_HOSTNAME ?? "localhost",
    port: parseInt(process.env.DATABASE_PORT ?? "3306"),
    user: process.env.DATABASE_USERNAME ?? "root",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "cdi2"
});

async function getTokenOwner(token: string): Promise<string | null> {
    if (!token) return null;
    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT owner FROM token WHERE token = ?", [token]);
        return rows[0]?.owner ?? null;
    } catch {
        return null;
    }
}

async function isAdminToken(token: string): Promise<boolean> {
    return (await getTokenOwner(token)) === "admin";
}

server.get("/ping", (req, res) => {
    res.send({ message: "pong!" });
});

server.get("/test-token", async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });

    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    res.send({ message: "Token is valid", user: owner });
});

server.post("/teams", express.json(), async (req, res) => {
    const name = req.body.name;
    const tag = req.body.tag;
    const color = req.body.color;
    const leader = req.body.leader;
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token))) return res.status(403).send({ error: "Unauthorized" });
    if (!name || !tag || !color || !leader) return res.status(400).send({ error: "Missing required fields" });

    try {
        await database.query("INSERT INTO team (name, tag, color, leader) VALUES (?, ?, ?, ?)", [
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

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
