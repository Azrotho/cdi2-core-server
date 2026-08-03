import express, { type Express } from "express";
import { type RowDataPacket, type Pool } from "mysql2/promise";
import { getTokenOwner } from "./utils.js";

export function initDataRoutes(server: Express, database: Pool) {
    
}