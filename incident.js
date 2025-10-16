document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please login first.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("userInfo").textContent =
    `Logged in as: ${user.id} (${user.organisation} | ${user.type})`;

  // Load users.json
  const response = await fetch("users.json");
  const users = await response.json();

  const tableBody = document.getElementById("incidentBody");
  const addRowBtn = document.getElementById("addRowBtn");
  const message = document.getElementById("message");

  addRowBtn.style.display = user.type === "admin" ? "inline-block" : "none";

  // Populate dropdown
  const populateUserDropdown = (select, preselectedUserId = "") => {
    select.innerHTML = "";
    let availableUsers = users;
    if (user.type === "supervisor") {
      availableUsers = users.filter(u => u.organisation === user.organisation);
    } else if (user.type === "monitor") {
      availableUsers = [user];
    }

    availableUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      select.appendChild(opt);
    });

    // Select the prefilled user_id if given, else current user (for monitor)
    if (preselectedUserId) {
      select.value = preselectedUserId;
    } else if (user.type === "monitor") {
      select.value = user.id;
    }
  };

  // Link user_id → organisation auto-update
  const linkUserToOrganisation = (row) => {
    const userSelect = row.querySelector(".user_id");
    const orgInput = row.querySelector(".organisation");

    const updateOrg = () => {
      const selectedUser = users.find(u => u.id === userSelect.value);
      orgInput.value = selectedUser ? selectedUser.organisation : "";
    };

    userSelect.addEventListener("change", updateOrg);
    updateOrg();
  };

  // Access control
  const setAccessByRole = (row) => {
    const caseIdField = row.querySelector(".case_id");
    const orgField = row.querySelector(".organisation");
    const verifyStatus = row.querySelector(".verifyStatus");
    const verifyRemarks = row.querySelector(".verifyRemarks");

    if (user.type === "admin") {
      row.querySelectorAll("input, select").forEach(el => el.disabled = false);
      return;
    }

    if (user.type === "supervisor") {
      orgField.disabled = true;
      verifyStatus.disabled = true;
      verifyRemarks.disabled = true;
      caseIdField.disabled = true;
      return;
    }

    if (user.type === "monitor") {
      const editable = [".below18", ".violence", ".armedGroup", ".incidentRemarks"];
      row.querySelectorAll("input, select").forEach(el => {
        const isEditable = editable.some(cls => el.classList.contains(cls));
        el.disabled = !isEditable;
      });
      caseIdField.disabled = true;
    }
  };

  // Add new row
  const addNewRow = () => {
    const newRow = tableBody.rows[0].cloneNode(true);
    newRow.querySelectorAll("input, select").forEach(el => (el.value = ""));
    tableBody.appendChild(newRow);

    const select = newRow.querySelector(".user_id");
    populateUserDropdown(select);
    linkUserToOrganisation(newRow);
    setAccessByRole(newRow);
  };
  addRowBtn.addEventListener("click", addNewRow);

  // Load CSV and populate table
  async function loadCSV() {
    try {
      const res = await fetch("CaseID.csv");
      if (!res.ok) throw new Error("Unable to load CSV");
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true }).data;

      // Remove default blank row first
      tableBody.innerHTML = "";

      parsed.forEach(entry => {
        const row = tableBody.insertRow();

        row.innerHTML = `
          <td><input type="text" class="case_id" value="${entry.case_id || ""}"></td>
          <td><select class="user_id"></select></td>
          <td><input type="text" class="organisation" value="${entry.organisation || ""}" disabled></td>
          <td>
            <select class="below18">
              <option value="">-- Select --</option>
              <option ${entry.below18 === "Yes" ? "selected" : ""}>Yes</option>
              <option ${entry.below18 === "No" ? "selected" : ""}>No</option>
            </select>
          </td>
          <td>
            <select class="violence">
              <option value="">-- Select --</option>
              <option ${entry.violence === "Yes" ? "selected" : ""}>Yes</option>
              <option ${entry.violence === "No" ? "selected" : ""}>No</option>
            </select>
          </td>
          <td>
            <select class="armedGroup">
              <option value="">-- Select --</option>
              <option ${entry.armedGroup === "Yes" ? "selected" : ""}>Yes</option>
              <option ${entry.armedGroup === "No" ? "selected" : ""}>No</option>
            </select>
          </td>
          <td><input type="text" class="incidentRemarks" value="${entry.incidentRemarks || ""}"></td>
          <td>
            <select class="verifyStatus">
              <option value="">-- Select --</option>
              <option ${entry.verifyStatus === "Verified" ? "selected" : ""}>Verified</option>
              <option ${entry.verifyStatus === "Confirmed (to a reasonable level)" ? "selected" : ""}>Confirmed (to a reasonable level)</option>
              <option ${entry.verifyStatus === "Unverified" ? "selected" : ""}>Unverified</option>
            </select>
          </td>
          <td><input type="text" class="verifyRemarks" value="${entry.verifyRemarks || ""}"></td>
        `;

        // ✅ Now populate dropdown *after* row is inserted
        const userSelect = row.querySelector(".user_id");
        populateUserDropdown(userSelect, entry.user_id);
        linkUserToOrganisation(row);
        setAccessByRole(row);
      });
    } catch (e) {
      console.error("CSV load failed:", e);
    }
  }
  await loadCSV();

  // Submit: save CSV
  document.getElementById("incidentForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const incidents = [];
    document.querySelectorAll("#incidentBody tr").forEach(row => {
      incidents.push({
        case_id: row.querySelector(".case_id").value,
        user_id: row.querySelector(".user_id").value,
        organisation: row.querySelector(".organisation").value,
        below18: row.querySelector(".below18").value,
        violence: row.querySelector(".violence").value,
        armedGroup: row.querySelector(".armedGroup").value,
        incidentRemarks: row.querySelector(".incidentRemarks").value,
        verifyStatus: row.querySelector(".verifyStatus").value,
        verifyRemarks: row.querySelector(".verifyRemarks").value
      });
    });

    const csv = Papa.unparse(incidents);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "CaseID.csv";
    link.click();

    message.style.color = "green";
    message.textContent = "Data saved successfully (CSV downloaded).";
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.replace("index.html");
  });
});
