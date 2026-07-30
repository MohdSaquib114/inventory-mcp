import pkg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();

    const schemaSQL = fs.readFileSync('./db/schema.sql', 'utf-8');

    console.log("Running schema...");
    await client.query(schemaSQL);
    console.log("Schema created");
    
    const seedSQL = fs.readFileSync('./db/seed.sql', 'utf-8');
    
    console.log("Seeding data...");
    await client.query(seedSQL);
    console.log("Data seeded successfully...");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
    console.log("Disconnected");
  }
}

run();