const API = window.API_BASE_URL.replace(/\/$/, "");
const app = document.getElementById("app");
let pageVersion = 0;

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));

const tags = (values = []) =>
  `<div class="tags">${values.map((value) =>
    `<span class="tag">${escapeHTML(value)}</span>`
  ).join("")}</div>`;

async function api(path, options) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

function navigate(path) {
  if (location.pathname + location.search !== path) {
    history.pushState(null, "", path);
  }
  route();
}

function externalLinks(links) {
  return Object.entries(links || {}).map(([label, value]) => {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) return "";

      return `<li>
        <a href="${escapeHTML(url.href)}"
           target="_blank" rel="noopener noreferrer">
          ${escapeHTML(label)} (opens a new tab)
        </a>
      </li>`;
    } catch {
      return "";
    }
  }).join("");
}

function inquiryLink(type, id) {
  const params = new URLSearchParams({
    source_type: type,
    source_id: id,
  });
  return `/inquiry?${params}`;
}

function profileLink(id) {
  return `/students/${encodeURIComponent(id)}`;
}

function projectLink(id) {
  return `/projects/${encodeURIComponent(id)}`;
}

function projectCards(projects) {
  return projects.map((project) => `
    <article class="card">
      <h3>
        <a href="${projectLink(project.id)}">
          ${escapeHTML(project.title)}
        </a>
      </h3>
      <p>${escapeHTML(project.description)}</p>
      ${tags(project.technologies)}
    </article>
  `).join("");
}

function choices(name, values, selected) {
  return values.map((value, index) => `
    <label for="${name}-${index}">
      <input type="checkbox"
             id="${name}-${index}"
             name="${name}"
             value="${escapeHTML(value)}"
             ${selected.includes(value) ? "checked" : ""}>
      ${escapeHTML(value)}
    </label>
  `).join("");
}

async function directory(params, version) {
  const skills = await api("/api/skills");
  if (version !== pageVersion) return;

  app.innerHTML = `
    <h1>Find your next collaborator</h1>
    <p class="muted">
      Discover students and alumni through their skills and project evidence.
    </p>
    <form id="filters" class="panel">
      <label for="search">Search name, headline, or skill</label>
      <input id="search" name="q" type="search"
             value="${escapeHTML(params.get("q") || "")}"
             placeholder="Try Python or XR">
      <fieldset>
        <legend>Skills — all selected skills must match</legend>
        <div class="choices">
          ${choices("skills", skills, params.getAll("skills"))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Availability — any selected value</legend>
        <div class="choices">
          ${choices("availability",
            ["internship", "full-time", "contract"],
            params.getAll("availability"))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Status — any selected value</legend>
        <div class="choices">
          ${choices("status", ["current", "alumni"], params.getAll("status"))}
        </div>
      </fieldset>
      <div class="actions">
        <button type="submit">Apply search and filters</button>
        <button type="button" class="secondary" id="clear">Clear all</button>
      </div>
    </form>
    <div id="active" class="panel" aria-label="Active filters"></div>
    <p id="count" role="status">Loading students…</p>
    <div id="results" class="grid"></div>
  `;

  document.getElementById("active").innerHTML =
    `<strong>Active filters</strong>${params.size
      ? `<ul>${[...params].map(([key, value]) =>
          `<li>${escapeHTML(key)}: ${escapeHTML(value)}</li>`
        ).join("")}</ul>`
      : "<p>None</p>"}`;

  document.getElementById("filters").addEventListener("submit", (event) => {
    event.preventDefault();
    const next = new URLSearchParams();

    for (const [key, value] of new FormData(event.currentTarget)) {
      const text = String(value).trim();
      if (text) next.append(key, text);
    }

    navigate(next.size ? `/?${next}` : "/");
  });

  document.getElementById("clear").addEventListener("click", () => {
    navigate("/");
  });

  try {
    const students = await api(`/api/students?${params}`);
    if (version !== pageVersion) return;

    document.getElementById("count").textContent =
      `${students.length} matching student${students.length === 1 ? "" : "s"}`;

    document.getElementById("results").innerHTML = students.length
      ? students.map((student) => `
          <article class="card">
            <p class="muted">${escapeHTML(student.status)}</p>
            <h2>
              <a href="${profileLink(student.id)}">
                ${escapeHTML(student.name)}
              </a>
            </h2>
            <p>${escapeHTML(student.headline)}</p>
            ${tags(student.skills)}
            <p>Available for: ${escapeHTML(student.availability.join(", "))}</p>
            <p>${student.project_count} project evidence item(s)</p>
          </article>
        `).join("")
      : "<p>No students match. Try clearing a filter.</p>";
  } catch (error) {
    if (version !== pageVersion) return;
    document.getElementById("count").textContent =
      `Could not load students: ${error.message}. Try applying the filters again.`;
  }
}

async function studentPage(id, version) {
  const student = await api(`/api/students/${encodeURIComponent(id)}`);
  if (version !== pageVersion) return;

  document.title = `${student.name} — Talent Discovery`;
  app.innerHTML = `
    <p><a href="/">Back to directory</a></p>
    <section class="panel">
      <h1>${escapeHTML(student.name)}</h1>
      <p>${escapeHTML(student.headline)}</p>
      <p><strong>Status:</strong> ${escapeHTML(student.status)}</p>
      <p><strong>Program:</strong> ${escapeHTML(student.program)}</p>
      <p><strong>Availability:</strong>
        ${escapeHTML(student.availability.join(", "))}
      </p>
      <h2>Standardized skills</h2>
      ${tags(student.skills)}
      <h2>Professional links</h2>
      <ul>${externalLinks(student.links)}</ul>
      <a class="button" href="${inquiryLink("student", student.id)}">
        Interested in working with this student
      </a>
    </section>
    <h2>Project evidence</h2>
    <div class="grid">${projectCards(student.projects)}</div>
  `;
}

async function projectPage(id, version) {
  const project = await api(`/api/projects/${encodeURIComponent(id)}`);
  if (version !== pageVersion) return;

  document.title = `${project.title} — Talent Discovery`;
  app.innerHTML = `
    <p><a href="/">Back to directory</a></p>
    <section class="panel">
      <h1>${escapeHTML(project.title)}</h1>
      <p>${escapeHTML(project.description)}</p>
      <p><strong>Domain:</strong> ${escapeHTML(project.domain)}</p>
      <h2>Technologies</h2>
      ${tags(project.technologies)}
      <h2>Contributors and roles</h2>
      <ul>
        ${project.contributors.map((person) => `
          <li>
            ${person.profile_available
              ? `<a href="${profileLink(person.student_id)}">
                   ${escapeHTML(person.name)}
                 </a>`
              : escapeHTML(person.name)}
            — ${escapeHTML(person.role)}
          </li>
        `).join("")}
      </ul>
      <h2>Public links and media</h2>
      <p class="muted">
        These are supplied external links. An unavailable external page
        does not affect this website.
      </p>
      <ul>${externalLinks(project.links)}</ul>
      <a class="button" href="${inquiryLink("project", project.id)}">
        Inquire about this project
      </a>
    </section>
  `;
}

async function inquiryPage(type, id, version) {
  if (!["student", "project"].includes(type) || !id) {
    throw Object.assign(new Error(
      "Open an inquiry from a student profile or project page."
    ), { status: 404 });
  }

  const record = await api(
    `/api/${type === "student" ? "students" : "projects"}/${encodeURIComponent(id)}`
  );
  if (version !== pageVersion) return;

  const sourceName = type === "student" ? record.name : record.title;
  const sourceURL = new URL(
    type === "student" ? profileLink(id) : projectLink(id),
    location.origin
  ).href;

  document.title = `Employer inquiry — ${sourceName}`;
  app.innerHTML = `
    <p><a href="${type === "student" ? profileLink(id) : projectLink(id)}">
      Back to ${escapeHTML(type)}
    </a></p>
    <h1>Employer inquiry</h1>
    <p>Regarding ${escapeHTML(type)}:
      <strong>${escapeHTML(sourceName)}</strong>
    </p>
    <p class="muted">
      Simulated intake for Release 1. No message is sent to an employer
      or student, and no inquiry is stored on the server.
    </p>
    <form id="inquiry" class="panel">
      <input type="hidden" name="source_type" value="${escapeHTML(type)}">
      <input type="hidden" name="source_id" value="${escapeHTML(id)}">
      <input type="hidden" name="source_name" value="${escapeHTML(sourceName)}">
      <input type="hidden" name="source_url" value="${escapeHTML(sourceURL)}">

      <div class="field">
        <label for="company">Company name</label>
        <input id="company" name="company_name" required maxlength="200">
      </div>
      <div class="field">
        <label for="contact">Contact name</label>
        <input id="contact" name="contact_name" required maxlength="200">
      </div>
      <div class="field">
        <label for="email">Contact email</label>
        <input id="email" name="contact_email" type="email"
               required maxlength="254">
      </div>
      <div class="field">
        <label for="description">Inquiry description</label>
        <textarea id="description" name="inquiry_description"
                  required maxlength="5000"></textarea>
      </div>
      <button type="submit">Submit simulated inquiry</button>
    </form>
    <div id="confirmation" role="status"></div>
  `;

  document.getElementById("inquiry").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    for (const input of form.querySelectorAll("input:not([type=hidden]), textarea")) {
      input.setCustomValidity(
        input.value.trim() ? "" : "Please enter a value."
      );
      input.oninput = () => input.setCustomValidity("");
    }

    if (!form.reportValidity()) return;

    const details = Object.fromEntries(new FormData(form));
    document.getElementById("confirmation").innerHTML = `
      <section class="panel">
        <h2 tabindex="-1" id="confirmation-heading">Simulated inquiry complete</h2>
        <p>Your inquiry retained the following context:</p>
        <dl>
          ${Object.entries(details).map(([key, value]) => `
            <dt><strong>${escapeHTML(key)}</strong></dt>
            <dd>${escapeHTML(value)}</dd>
          `).join("")}
        </dl>
        <p>This demonstration has not sent or stored your inquiry.</p>
      </section>
    `;
    document.getElementById("confirmation-heading").focus();
  });
}

// Preserve the original Phase 0 workflow.
async function itemsPage(version) {
  app.innerHTML = `
    <h1>Phase 0 Items</h1>
    <form id="add-item" class="panel">
      <label for="item-title">New item title</label>
      <input id="item-title" name="title" autocomplete="off">
      <button type="submit">Add</button>
    </form>
    <p id="item-status" role="status"></p>
    <ul id="items"></ul>
  `;

  async function loadItems() {
    const items = await api("/api/items");
    if (version !== pageVersion) return;
    document.getElementById("items").innerHTML = items.map((item) =>
      `<li>${escapeHTML(item.title)}</li>`
    ).join("");
  }

  document.getElementById("add-item").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("item-title").value,
        }),
      });
      if (version !== pageVersion) return;
      document.getElementById("item-title").value = "";
      document.getElementById("item-status").textContent = "Item added.";
      await loadItems();
    } catch (error) {
      if (version !== pageVersion) return;
      document.getElementById("item-status").textContent = error.message;
    }
  });

  await loadItems();
}

async function route() {
  const version = ++pageVersion;
  document.title = "Talent Discovery";
  app.innerHTML = '<p role="status">Loading…</p>';

  try {
    const parts = location.pathname.split("/")
      .filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(location.search);

    if (parts.length === 0) {
      await directory(params, version);
    } else if (parts.length === 2 && parts[0] === "students") {
      await studentPage(parts[1], version);
    } else if (parts.length === 2 && parts[0] === "projects") {
      await projectPage(parts[1], version);
    } else if (parts.length === 1 && parts[0] === "inquiry") {
      await inquiryPage(
        params.get("source_type"), params.get("source_id"), version
      );
    } else if (parts.length === 1 && parts[0] === "items") {
      await itemsPage(version);
    } else {
      throw Object.assign(new Error("Page not found"), { status: 404 });
    }
  } catch (error) {
    if (version !== pageVersion) return;
    app.innerHTML = `
      <section class="panel">
        <h1>${error.status === 404 ? "Not found" : "Unable to load this page"}</h1>
        <p>${escapeHTML(error.message)}</p>
        <p><a href="/">Return to directory</a></p>
        <button id="retry">Try again</button>
      </section>
    `;
    document.getElementById("retry").addEventListener("click", route);
  }

  if (version === pageVersion) {
    document.getElementById("main").focus();
  }
}

// Handle internal links without refreshing the entire page.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 ||
      event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

  const link = event.target.closest("a[href]");
  if (!link || link.hasAttribute("target") ||
      link.hasAttribute("download") ||
      link.getAttribute("href").startsWith("#")) return;

  const url = new URL(link.href);
  if (url.origin !== location.origin) return;

  event.preventDefault();
  navigate(url.pathname + url.search);
});

window.addEventListener("popstate", route);
route();