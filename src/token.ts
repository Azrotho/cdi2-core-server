import express, { type Express } from "express";
import { type Pool } from "mysql2/promise";
import { getTokenOwner, pass, isAdminToken } from "./utils.js";


export function initTokenRoutes(server: Express, database: Pool) {
    server.get("/test-token", async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });

    const owner = await getTokenOwner(token, database);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    res.send({ message: "Token is valid", user: owner });
});

server.post("/token", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

    const owner = req.body.owner;
    if (!owner) return res.status(400).send({ error: "No owner provided" });

    const newToken = pass(128);
    try {
        await database.query("INSERT INTO token (token, owner) VALUES (?, ?)", [newToken, owner]);
        res.send({ message: "Token created successfully", token: newToken });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create token" });
    }
});

server.delete("/token", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

    const tokenToDelete = req.body.token;
    if (!tokenToDelete) return res.status(400).send({ error: "No token provided to delete" });

    try {
        await database.query("DELETE FROM token WHERE token = ?", [tokenToDelete]);
        res.send({ message: "Token deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete token" });
    }
});
}