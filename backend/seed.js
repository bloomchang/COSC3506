require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
});

function readFixture(filename) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", filename), "utf8")
  );
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from backend/.env");
  }

  const students = readFixture("students.json");
  const projects = readFixture("projects.json");
  const skills = readFixture("skills.json");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS talent_students (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS talent_projects (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS talent_skills (
        name TEXT PRIMARY KEY
      );
    `);

    for (const student of students) {
      await client.query(
        `INSERT INTO talent_students (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [student.id, JSON.stringify(student)]
      );
    }

    for (const project of projects) {
      await client.query(
        `INSERT INTO talent_projects (id, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [project.id, JSON.stringify(project)]
      );
    }

    for (const skill of skills) {
      await client.query(
        `INSERT INTO talent_skills (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [skill]
      );
    }

    await client.query("COMMIT");
    console.log("Success! Talent fixtures imported into the database.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch(() => {
    console.error(
      "Import failed. Check DATABASE_URL, database access, and fixture files."
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());