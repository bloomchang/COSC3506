# Release 1 — Public Talent Discovery

## Submission details

- Team: Team 04
- Project: Project 1 — Public Talent Discovery
- Repository: https://github.com/bloomchang/COSC3506
- Public application: https://cosc3506-team04-frontend.onrender.com/
- Backend health: https://cosc3506-k24r.onrender.com/api/health
- Release tag: R1-submission — pending creation
- Frozen commit SHA: pending final verification
- Evaluation adapter: evaluation_adapter.json

## Release notes

- Imported student, project, and standardized skill fixtures into PostgreSQL.
- Added public APIs for the talent directory, student profiles, and projects.
- Restricted public student discovery and profiles to published students.
- Added case-insensitive text search and structured skill, availability,
  and status filters.
- Multiple skills combine with AND. Availability and status selections
  combine with OR within each category.
- Added student profiles and shared project evidence pages.
- Added contextual simulated employer inquiries.
- Added useful not-found states for invalid student and project IDs.

## Technology and deployment summary

The frontend uses HTML, CSS, and JavaScript and is hosted as a Render
Static Site. The backend uses Node.js and Express on a Render Web Service.
Persistent data is stored in Supabase PostgreSQL.

The supplied fixtures are imported using backend/seed.js. Public talent
data is served by the backend API from the database.

The frontend uses a Render rewrite from /* to /index.html to support
direct navigation and reloads on application routes.

## Inquiry configuration

The application uses a simulated intake form at /inquiry.

Start an inquiry from a student or project page. The application retains
source_type, source_id, source_name, and source_url automatically.
A project inquiry identifies the project rather than choosing a contributor.

Example entry:
https://cosc3506-team04-frontend.onrender.com/inquiry?source_type=project&source_id=P01

The simulation displays a confirmation. It does not send or store an
employer inquiry.

## Manual verification

- Searched AVERY and confirmed Avery Chen appeared.
- Selected Unity and Blender and confirmed the expected four students.
- Combined those skills with contract/full-time availability and both
  statuses; confirmed only Maya Patel and Priya Desai appeared.
- Reloaded the filtered directory and confirmed the results stayed the same.
- Confirmed unpublished student S16 and invalid student/project URLs
  displayed useful not-found states.

## Known issues and limitations

- Employer intake is simulated; no inquiry is delivered or stored.
- The supplied P07 fixture contains an intentionally broken external link.
- Testing recorded here was performed in Chrome; other browsers have
  not been verified.

## Browser assumptions

JavaScript must be enabled. The public workflow requires no login.