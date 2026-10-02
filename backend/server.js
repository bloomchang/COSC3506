require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
});

// Forward asynchronous errors to the error handler.
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve()
    .then(() => handler(req, res, next))
    .catch(next);

// Support repeated query parameters for multiple filters.
function filterValues(value) {
  if (value === undefined) return [];

  const values = Array.isArray(value) ? value : [value];

  if (!values.every((item) => typeof item === "string")) {
    const error = new Error("Invalid filter");
    error.status = 400;
    throw error;
  }

  return [...new Set(values)];
}

// Database health check.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "reachable" });
  } catch (_error) {
    res.status(503).json({
      ok: false,
      error: "database unavailable",
    });
  }
});

// Existing Phase 0 routes.
app.get("/api/items", asyncRoute(async (_req, res) => {
  const result = await pool.query(
    "SELECT id, title, created_at FROM items ORDER BY created_at DESC"
  );

  res.json(result.rows);
}));

app.post("/api/items", asyncRoute(async (req, res) => {
  // INTENTIONAL DEFECT: whitespace-only titles are accepted.
  const title = typeof req.body?.title === "string"
    ? req.body.title
    : "";

  if (title.length === 0) {
    return res.status(400).json({ error: "title is required" });
  }

  const result = await pool.query(
    `INSERT INTO items (title)
     VALUES ($1)
     RETURNING id, title, created_at`,
    [title]
  );

  res.status(201).json(result.rows[0]);
}));

// Standardized skill choices.
app.get("/api/skills", asyncRoute(async (_req, res) => {
  const result = await pool.query(
    "SELECT name FROM talent_skills ORDER BY name"
  );

  res.json(result.rows.map((row) => row.name));
}));

// Public directory with search and filters.
app.get("/api/students", asyncRoute(async (req, res) => {
  if (
    req.query.q !== undefined &&
    typeof req.query.q !== "string"
  ) {
    return res.status(400).json({ error: "Search must be text" });
  }

  const text = (req.query.q || "").trim().toLowerCase();
  const selectedSkills = filterValues(req.query.skills);
  const availability = filterValues(req.query.availability);
  const status = filterValues(req.query.status);

  const skillResult = await pool.query(
    "SELECT name FROM talent_skills"
  );

  const validSkills = new Set(
    skillResult.rows.map((row) => row.name)
  );

  if (
    selectedSkills.some((skill) => !validSkills.has(skill)) ||
    availability.some((value) =>
      !["internship", "full-time", "contract"].includes(value)
    ) ||
    status.some((value) =>
      !["current", "alumni"].includes(value)
    )
  ) {
    return res.status(400).json({ error: "Unknown filter value" });
  }

  const result = await pool.query(`
    SELECT data FROM talent_students
    WHERE data->>'profile_status' = 'published'
    ORDER BY id
  `);

  const matches = result.rows
    .map((row) => row.data)
    .filter((student) => {
      const searchable = [
        student.name,
        student.headline,
        ...student.skills,
      ];

      return (
        (!text || searchable.some((value) =>
          value.toLowerCase().includes(text)
        )) &&
        selectedSkills.every((skill) =>
          student.skills.includes(skill)
        ) &&
        (!availability.length || availability.some((value) =>
          student.availability.includes(value)
        )) &&
        (!status.length || status.includes(student.status))
      );
    })
    .map((student) => ({
      ...student,
      project_count: student.project_ids.length,
    }));

  res.json(matches);
}));

// Published student profile and associated projects.
app.get("/api/students/:id", asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT data FROM talent_students
     WHERE id = $1
       AND data->>'profile_status' = 'published'`,
    [req.params.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Student not found" });
  }

  const student = result.rows[0].data;

  const projectResult = await pool.query(
    `SELECT data FROM talent_projects
     WHERE id = ANY($1::text[])
     ORDER BY id`,
    [student.project_ids]
  );

  res.json({
    ...student,
    projects: projectResult.rows.map((row) => row.data),
  });
}));

// Canonical project page data, including contributor roles.
app.get("/api/projects/:id", asyncRoute(async (req, res) => {
  const result = await pool.query(
    "SELECT data FROM talent_projects WHERE id = $1",
    [req.params.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Project not found" });
  }

  const project = result.rows[0].data;

  const contributorResult = await pool.query(
    `SELECT id, data FROM talent_students
     WHERE id = ANY($1::text[])`,
    [project.contributors.map((person) => person.student_id)]
  );

  const people = new Map(
    contributorResult.rows.map((row) => [row.id, row.data])
  );

  res.json({
    ...project,
    contributors: project.contributors.map((contributor) => {
      const student = people.get(contributor.student_id);
      const published = student?.profile_status === "published";

      return {
        student_id: published ? contributor.student_id : null,
        name: published ? student.name : "Unpublished contributor",
        role: contributor.role,
        profile_available: published,
      };
    }),
  });
}));

// Unknown API route.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Error handler must come after the routes.
app.use((err, _req, res, _next) => {
  const status = [400, 413].includes(err.status)
    ? err.status
    : 500;

  res.status(status).json({
    error:
      status === 400
        ? "Invalid request or filter"
        : status === 413
          ? "Request body is too large"
          : "Unexpected server error",
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API listening on ${port}`);
});