import dotenv from "dotenv";
import express from "express";

dotenv.config();

const server = express();

server.get("/", (req, res) => {
    res.send({ message: "Hello, World!" });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
