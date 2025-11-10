/***************************************************
 * CRMM Incident Portal | Role-based Filters & Edit Access
 * --------------------------------------------------------
 * Admin → 2 filters: Organisation + User (full edit)
 * Admin_User → same as Admin but limited to SCI, IRC, UNICEF
 * Supervisor → 1 filter: User (own org only), can edit 5 fields
 * Monitor → No filters, can edit & submit 4 fields:
 *           below18, violence, armedgroup, incidentremarks
 ***************************************************/

// ==============================================
// ✅ Firebase Setup
// ==============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==============================================
// ✅ Firebase Configuration
// ==============================================
const firebaseConfig = {
  apiKey: "AIzaSyDP1uofFj_RHYZWLprN4P613UyXgi1suM30",
  authDomain: "crmm-cxb.firebaseapp.com",
  projectId: "crmm-cxb",
  storageBucket: "crmm-cxb.appspot.com",
  messagingSenderId: "920459967885",
  appId: "1:920459967885:web:402c2800ebe786ee5391c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==============================================
// ✅ Utility Functions
// ==============================================
function toYMD(dateVal) {
  if (!dateVal) return "";
  if (dateVal && typeof dateVal.toDate === "function") {
    const d = dateVal.toDate();
    return d.toISOString().slice(0, 10);
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d)) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function daysBetweenYMD(ymd) {
  if (!ymd) return "";
  const assigned = new Date(ymd + "T00:00:00");
  if (isNaN(assigned)) return "";
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(assigned.getFullYear(), assigned.getMonth(), assigned.getDate());
  const utcB = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((utcB - utcA) / msPerDay);
  return String(Math.max(0, diff));
}

// ==============================================
// ✅ DOM Ready
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please login first.");
    window.location.href = "index.html";
    return;
  }

  // Display logged-in user info
  document.getElementById("userInfo").textContent =
    `Logged in as: ${user.id} (${user.organisation} | ${user.type})`;

  // DOM references
  const tableBody = document.getElementById("incidentBody");
  const message = document.getElementById("message");
  const orgFilter = document.getElementById("organisationFilter");
  const userFilter = document.getElementById("userFilter");
  const orgFilterGroup = document.getElementById("orgFilterGroup");
  const userFilterGroup = document.getElementById("userFilterGroup");
  const filterContainer = document.getElementById("filterContainer");
  const applyFilterBtn = document.getElementById("applyFilterBtn");

  // Load users.json
  const response = await fetch("users.json");
  const users = await response.json();

  // Helper: populate orgs/users with a leading "--"
  function populateOrgs(orgList) {
    orgFilter.innerHTML = `<option value="">--</option>`;
    orgList.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      orgFilter.appendChild(opt);
    });
  }
  function populateUsers(userList) {
    userFilter.innerHTML = `<option value="">--</option>`;
    userList.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });
  }

  // ==============================================
  // ✅ FILTER SETUP
  // ==============================================
  if (user.type === "admin" || user.type === "admin_user") {
    filterContainer.style.display = "flex";
    orgFilterGroup.style.display = "block";
    userFilterGroup.style.display = "block";

    const allowedOrgs = (user.type === "admin")
      ? [...new Set(users.map(u => u.organisation))]
      : ["SCI", "IRC", "UNICEF"];

    let allowedUsers = users.filter(u => allowedOrgs.includes(u.organisation));

    // Initial fill
    populateOrgs(allowedOrgs);
    populateUsers(allowedUsers);

    // --- Coupled behavior ---

    // 1) Organisation → limit Users to that org (or all if "--")
    orgFilter.addEventListener("change", () => {
      const selectedOrg = orgFilter.value; // "" means "--"
      if (!selectedOrg) {
        // No org chosen → show all allowed users
        allowedUsers = users.filter(u => allowedOrgs.includes(u.organisation));
        populateUsers(allowedUsers);
        // do NOT force userFilter; keep as selected or "--"
        return;
      }
      // Org chosen → show only that org’s users
      const filteredUsers = users.filter(
        u => allowedOrgs.includes(u.organisation) && u.organisation === selectedOrg
      );
      populateUsers(filteredUsers);
      // If a user was previously selected from another org, it gets cleared to "--"
    });

    // 2) User → collapse Organisation to that user’s org (or all if "--")
    userFilter.addEventListener("change", () => {
      const selectedUser = users.find(u => u.id === userFilter.value);
      if (!selectedUser) {
        // User = "--" → restore all allowed orgs
        if (user.type === "admin_user") {
          populateOrgs(["SCI", "IRC", "UNICEF"]); // explicit per request
        } else {
          populateOrgs(allowedOrgs);
        }
        // keep org selection as-is (user might have set one)
        return;
      }
      // User chosen → lock org list to only that org and set the value
      populateOrgs([selectedUser.organisation]);
      orgFilter.value = selectedUser.organisation;
    });

  } else if (user.type === "supervisor") {
    filterContainer.style.display = "flex";
    userFilterGroup.style.display = "block";
    const sameOrgUsers = users.filter(u => u.organisation === user.organisation);
    populateUsers(sameOrgUsers);
  } else {
    // monitor
    filterContainer.style.display = "none";
  }

  // ==============================================
  // ✅ Populate User Dropdown in Table
  // ==============================================
  const populateUserDropdown = (select, preselectedUserId = "") => {
    select.innerHTML = "";
    let availableUsers = users;

    if (user.type === "supervisor") {
      availableUsers = users.filter(u => u.organisation === user.organisation);
    } else if (user.type === "monitor") {
      availableUsers = [user];
    } else if (user.type === "admin_user") {
      availableUsers = users.filter(u => ["SCI", "IRC", "UNICEF"].includes(u.organisation));
    }

    availableUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      select.appendChild(opt);
    });

    if (preselectedUserId) select.value = preselectedUserId;
    else if (user.type === "monitor") select.value = user.id;
  };

  // ==============================================
  // ✅ Auto-link Organisation to User in table
  // ==============================================
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

  // ==============================================
  // ✅ Role-based Access
  // ==============================================
  const setAccessByRole = (row) => {
    const allInputs = row.querySelectorAll("input, select");

    if (user.type === "admin" || user.type === "admin_user") {
      allInputs.forEach(el => (el.disabled = false));
      return;
    }

    if (user.type === "supervisor") {
      allInputs.forEach(el => (el.disabled = true));
      [".user_id", ".below18", ".violence", ".armedGroup", ".incidentRemarks"]
        .forEach(cls => {
          const el = row.querySelector(cls);
          if (el) el.disabled = false;
        });
      return;
    }

    if (user.type === "monitor") {
      allInputs.forEach(el => (el.disabled = true));
      [".below18", ".violence", ".armedGroup", ".incidentRemarks"]
        .forEach(cls => {
          const el = row.querySelector(cls);
          if (el) el.disabled = false;
        });
    }
  };

  // ==============================================
  // ✅ Assigned date & days elapsed
  // ==============================================
  function buildAssignedCells(data) {
    const ymd = toYMD(data.dateassigned);
    const days = ymd ? daysBetweenYMD(ymd) : "";
    if (user.type === "admin" || user.type === "admin_user") {
      return `
        <td class="cell-dateassigned">
          <input type="date" class="dateassigned-input" value="${ymd || ""}">
        </td>
        <td class="cell-dayselapsed">${days}</td>`;
    } else {
      return `
        <td class="cell-dateassigned">
          <span class="dateassigned-text">${ymd || ""}</span>
        </td>
        <td class="cell-dayselapsed">${days}</td>`;
    }
  }

  // ==============================================
  // ✅ Add row
  // ==============================================
  const addNewRow = (data = {}) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="case_id" value="${data.case_id || ""}" readonly></td>
      <td><select class="user_id"></select></td>
      <td><input type="text" class="organisation" value="${data.organisation || ""}" disabled></td>
      <td>
        <select class="below18">
          <option value="">--</option>
          <option value="Yes" ${data.below18 === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.below18 === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="violence">
          <option value="">--</option>
          <option value="Yes" ${data.violence === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.violence === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="armedGroup">
          <option value="">--</option>
          <option value="Yes" ${data.armedgroup === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.armedgroup === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      ${buildAssignedCells(data)}
      <td><input type="text" class="incidentRemarks" value="${data.incidentremarks || ""}" placeholder="Remarks..."></td>
      <td>
        <select class="verifyStatus">
          <option value="">--</option>
          <option value="Verified" ${data.verifystatus === "Verified" ? "selected" : ""}>Verified</option>
          <option value="Confirmed (to a reasonable level)" ${data.verifystatus === "Confirmed (to a reasonable level)" ? "selected" : ""}>Confirmed (to a reasonable level)</option>
          <option value="Unverified" ${data.verifystatus === "Unverified" ? "selected" : ""}>Unverified</option>
        </select>
      </td>
      <td><input type="text" class="verifyRemarks" value="${data.verifyremarks || ""}" placeholder="Verification notes..."></td>`;
    tableBody.appendChild(tr);
    populateUserDropdown(tr.querySelector(".user_id"), data.user_id);
    linkUserToOrganisation(tr);
    setAccessByRole(tr);
  };

  // ==============================================
  // ✅ Live recompute of days elapsed when admin edits assigned date
  // ==============================================
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches(".dateassigned-input")) {
      const tr = el.closest("tr");
      const daysCell = tr.querySelector(".cell-dayselapsed");
      const ymd = el.value || "";
      daysCell.textContent = ymd ? daysBetweenYMD(ymd) : "";
    }
  });

  // ==============================================
  // ✅ Load Data
  // ==============================================
  async function loadFirestoreData() {
    try {
      const incidentsRef = collection(db, "incidents");
      let q;

      if (user.type === "admin" || user.type === "admin_user") {
        q = incidentsRef;
      } else if (user.type === "supervisor") {
        q = query(incidentsRef, where("organisation", "==", user.organisation));
      } else {
        q = query(incidentsRef, where("user_id", "==", user.id));
      }

      const snapshot = await getDocs(q);
      const orgSelected = orgFilter?.value || "";
      const userSelected = userFilter?.value || "";

      tableBody.innerHTML = "";

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (user.type === "admin" || user.type === "admin_user") {
          if (orgSelected && data.organisation !== orgSelected) return;
          if (userSelected && data.user_id !== userSelected) return;
        } else if (user.type === "supervisor") {
          if (userSelected && data.user_id !== userSelected) return;
        }
        addNewRow(data);
      });

      message.style.color = "green";
      message.textContent = `✅ Data loaded for ${user.type}`;
    } catch (err) {
      console.error("⚠️ Load error:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Failed to load data.";
    }
  }

  await loadFirestoreData();
  applyFilterBtn?.addEventListener("click", loadFirestoreData);

  // ==============================================
  // ✅ Save Button
  // ==============================================
  document.getElementById("incidentForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!["admin", "admin_user", "supervisor", "monitor"].includes(user.type)) {
      alert("You don’t have permission to save data.");
      return;
    }

    const rows = document.querySelectorAll("#incidentBody tr");
    if (!rows.length) {
      alert("No data to save.");
      return;
    }

    const allowedOrgs = ["SCI", "IRC", "UNICEF"];
    const toSave = [];

    rows.forEach(row => {
      const caseId = row.querySelector(".case_id").value.trim() ||
        `case_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      let rec = { case_id: caseId, updatedBy: user.id, updatedAt: new Date().toISOString() };

      if (user.type === "monitor") {
        rec.below18 = row.querySelector(".below18").value;
        rec.violence = row.querySelector(".violence").value;
        rec.armedgroup = row.querySelector(".armedGroup").value;
        rec.incidentremarks = row.querySelector(".incidentRemarks").value;

      } else if (user.type === "supervisor") {
        rec.user_id = row.querySelector(".user_id").value;
        rec.organisation = row.querySelector(".organisation").value;
        rec.below18 = row.querySelector(".below18").value;
        rec.violence = row.querySelector(".violence").value;
        rec.armedgroup = row.querySelector(".armedGroup").value;
        rec.incidentremarks = row.querySelector(".incidentRemarks").value;

      } else {
        const orgVal = row.querySelector(".organisation").value;
        if (user.type === "admin_user" && !allowedOrgs.includes(orgVal)) return;

        rec.user_id = row.querySelector(".user_id").value;
        rec.organisation = orgVal;
        rec.below18 = row.querySelector(".below18").value;
        rec.violence = row.querySelector(".violence").value;
        rec.armedgroup = row.querySelector(".armedGroup").value;
        rec.incidentremarks = row.querySelector(".incidentRemarks").value;
        rec.verifystatus = row.querySelector(".verifyStatus").value;
        rec.verifyremarks = row.querySelector(".verifyRemarks").value;

        const dateInput = row.querySelector(".dateassigned-input");
        if (dateInput) rec.dateassigned = dateInput.value || null;
      }
      toSave.push(rec);
    });

    try {
      for (const r of toSave) await setDoc(doc(db, "incidents", r.case_id), r, { merge: true });
      message.style.color = "green";
      message.textContent = `✅ ${toSave.length} record(s) saved successfully.`;
    } catch (err) {
      console.error("❌ Save failed:", err);
      message.style.color = "red";
      message.textContent = "❌ Failed to save data.";
    }
  });

  // ==============================================
  // ✅ Logout
  // ==============================================
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.replace("index.html");
  });
});
