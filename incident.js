/***************************************************
 * CRMM Incident Portal | Role-based Filters & Edit Access
 * --------------------------------------------------------
 * Admin → 2 filters: Organisation + User (full edit)
 * Admin_User → same as Admin but limited to SCI, IRC, UNICEF
 * Supervisor → 1 filter: User (own org only), can edit 5 fields
 * Monitor → No filters, can edit 3 fields
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
// ✅ DOM Ready
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please login first.");
    window.location.href = "index.html";
    return;
  }

  // Display logged-in user
  document.getElementById("userInfo").textContent =
    `Logged in as: ${user.id} (${user.organisation} | ${user.type})`;

  // DOM elements
  const tableBody = document.getElementById("incidentBody");
  const message = document.getElementById("message");
  const filterContainer = document.getElementById("filterContainer");
  const orgFilterGroup = document.getElementById("orgFilterGroup");
  const userFilterGroup = document.getElementById("userFilterGroup");
  const orgFilter = document.getElementById("organisationFilter");
  const userFilter = document.getElementById("userFilter");
  const applyFilterBtn = document.getElementById("applyFilterBtn");

  // Load users.json
  const response = await fetch("users.json");
  const users = await response.json();

  // ==============================================
  // ✅ Role-based Filter Setup
  // ==============================================
  if (user.type === "admin") {
    filterContainer.style.display = "flex";
    orgFilterGroup.style.display = "block";
    userFilterGroup.style.display = "block";

    const orgs = [...new Set(users.map(u => u.organisation))];
    orgs.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      orgFilter.appendChild(opt);
    });

    users.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });

  } else if (user.type === "admin_user") {
    filterContainer.style.display = "flex";
    orgFilterGroup.style.display = "block";
    userFilterGroup.style.display = "block";

    const allowedOrgs = ["SCI", "IRC", "UNICEF"];
    allowedOrgs.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      orgFilter.appendChild(opt);
    });

    const allowedUsers = users.filter(u => allowedOrgs.includes(u.organisation));
    allowedUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });

  } else if (user.type === "supervisor") {
    filterContainer.style.display = "flex";
    userFilterGroup.style.display = "block";

    const sameOrgUsers = users.filter(u => u.organisation === user.organisation);
    sameOrgUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });
  }

  // ==============================================
  // ✅ Populate User Dropdown in Table
  // ==============================================
  const populateUserDropdown = (select, preselectedUserId = "") => {
    select.innerHTML = "";
    let availableUsers = users;

    if (user.type === "supervisor")
      availableUsers = users.filter(u => u.organisation === user.organisation);
    else if (user.type === "monitor")
      availableUsers = [user];
    else if (user.type === "admin_user") {
      const allowedOrgs = ["SCI", "IRC", "UNICEF"];
      availableUsers = users.filter(u => allowedOrgs.includes(u.organisation));
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
  // ✅ Auto-link Organisation to User
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
  // ✅ Role-based Access Control
  // ==============================================
  const setAccessByRole = (row) => {
    const allInputs = row.querySelectorAll("input, select");

    // 🔹 Admin / Admin_User → Full access
    if (user.type === "admin" || user.type === "admin_user") {
      allInputs.forEach(el => (el.disabled = false));
      return;
    }

    // 🔹 Supervisor → Limited edit rights
    if (user.type === "supervisor") {
      allInputs.forEach(el => (el.disabled = true));
      const editable = [
        ".user_id",
        ".below18",
        ".violence",
        ".armedGroup",
        ".incidentRemarks"
      ];
      editable.forEach(cls => {
        const el = row.querySelector(cls);
        if (el) el.disabled = false;
      });
      return;
    }

    // 🔹 Monitor → Only 3 editable
    if (user.type === "monitor") {
      allInputs.forEach(el => (el.disabled = true));
      const editable = [".below18", ".violence", ".armedGroup"];
      editable.forEach(cls => {
        const el = row.querySelector(cls);
        if (el) el.disabled = false;
      });
    }
  };

  // ==============================================
  // ✅ Add Table Row
  // ==============================================
  const addNewRow = (data = {}) => {
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><input type="text" class="case_id" value="${data.case_id || ""}" readonly></td>
      <td><select class="user_id"></select></td>
      <td><input type="text" class="organisation" value="${data.organisation || ""}" disabled></td>
      <td>
        <select class="below18">
          <option value="">-- Select --</option>
          <option value="Yes" ${data.below18 === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.below18 === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="violence">
          <option value="">-- Select --</option>
          <option value="Yes" ${data.violence === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.violence === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="armedGroup">
          <option value="">-- Select --</option>
          <option value="Yes" ${data.armedgroup === "Yes" ? "selected" : ""}>Yes</option>
          <option value="No" ${data.armedgroup === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td><input type="text" class="incidentRemarks" value="${data.incidentremarks || ""}" placeholder="Remarks..."></td>
      <td>
        <select class="verifyStatus">
          <option value="">-- Select --</option>
          <option value="Verified" ${data.verifystatus === "Verified" ? "selected" : ""}>Verified</option>
          <option value="Confirmed (to a reasonable level)" ${data.verifystatus === "Confirmed (to a reasonable level)" ? "selected" : ""}>Confirmed (to a reasonable level)</option>
          <option value="Unverified" ${data.verifystatus === "Unverified" ? "selected" : ""}>Unverified</option>
        </select>
      </td>
      <td><input type="text" class="verifyRemarks" value="${data.verifyremarks || ""}" placeholder="Verification notes..."></td>
    `;
    tableBody.appendChild(newRow);
    populateUserDropdown(newRow.querySelector(".user_id"), data.user_id);
    linkUserToOrganisation(newRow);
    setAccessByRole(newRow);
  };

  // ==============================================
  // ✅ Load Firestore Data (with filters)
  // ==============================================
  async function loadFirestoreData() {
    try {
      const incidentsRef = collection(db, "incidents");
      let q;

      if (user.type === "admin" || user.type === "admin_user")
        q = incidentsRef;
      else if (user.type === "supervisor")
        q = query(incidentsRef, where("organisation", "==", user.organisation));
      else if (user.type === "monitor")
        q = query(incidentsRef, where("user_id", "==", user.id));

      const snapshot = await getDocs(q);
      const orgSelected = orgFilter?.value || "";
      const userSelected = userFilter?.value || "";

      tableBody.innerHTML = "";

      snapshot.forEach(docSnap => {
        const data = docSnap.data();

        // ✅ Apply client-side filters
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
      console.error("⚠️ Firestore load failed:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Could not load data from Firestore.";
    }
  }

  await loadFirestoreData();
  applyFilterBtn?.addEventListener("click", async () => await loadFirestoreData());

  // ==============================================
  // ✅ Save Data (Admin, Admin_User, Supervisor)
  // ==============================================
  document.getElementById("incidentForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!["admin", "admin_user", "supervisor"].includes(user.type)) {
      alert("You don’t have permission to save data.");
      return;
    }

    const rows = document.querySelectorAll("#incidentBody tr");
    if (rows.length === 0) {
      alert("No data to save.");
      return;
    }

    const allowedOrgs = ["SCI", "IRC", "UNICEF"];
    const incidents = [];

    rows.forEach((row) => {
      const orgVal = row.querySelector(".organisation").value.trim();
      if (user.type === "admin_user" && !allowedOrgs.includes(orgVal)) return;

      const caseId =
        row.querySelector(".case_id").value.trim() ||
        `case_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      incidents.push({
        case_id: caseId,
        user_id: row.querySelector(".user_id").value,
        organisation: orgVal,
        below18: row.querySelector(".below18").value,
        violence: row.querySelector(".violence").value,
        armedgroup: row.querySelector(".armedGroup").value,
        incidentremarks: row.querySelector(".incidentRemarks").value,
        verifystatus: row.querySelector(".verifyStatus").value,
        verifyremarks: row.querySelector(".verifyRemarks").value,
        updatedBy: user.id,
        updatedAt: new Date().toISOString()
      });
    });

    if (incidents.length === 0) {
      message.style.color = "red";
      message.textContent = "⚠️ No valid records to save.";
      return;
    }

    try {
      for (const inc of incidents) {
        await setDoc(doc(db, "incidents", inc.case_id), inc, { merge: true });
      }
      message.style.color = "green";
      message.textContent = `✅ ${incidents.length} record(s) successfully saved to Firestore.`;
    } catch (err) {
      console.error("❌ Firestore save error:", err);
      message.style.color = "red";
      message.textContent = "❌ Failed to save data to Firestore.";
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
