/***************************************************
 * CRMM Incident Portal | Role-based Filters
 * -----------------------------------------------
 * Admin → 2 filters: Organisation + User
 * Supervisor → 1 filter: User (own org only)
 * Monitor → No filters
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

  // Display user info
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

    // Populate organisation list
    const orgs = [...new Set(users.map(u => u.organisation))];
    orgs.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      orgFilter.appendChild(opt);
    });

    // Populate all users
    users.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });

  } else if (user.type === "supervisor") {
    filterContainer.style.display = "flex";
    userFilterGroup.style.display = "block";

    // Only users from same organisation
    const sameOrgUsers = users.filter(u => u.organisation === user.organisation);
    sameOrgUsers.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.id;
      userFilter.appendChild(opt);
    });
  }

  // ==============================================
  // ✅ Populate user dropdown in table
  // ==============================================
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
    const caseIdField = row.querySelector(".case_id");
    const orgField = row.querySelector(".organisation");
    const verifyStatus = row.querySelector(".verifyStatus");
    const verifyRemarks = row.querySelector(".verifyRemarks");

    if (user.type === "admin") {
      row.querySelectorAll("input, select").forEach(el => el.disabled = false);
      return;
    }

    if (user.type === "supervisor") {
      caseIdField.disabled = true;
      orgField.disabled = true;
      verifyStatus.disabled = true;
      verifyRemarks.disabled = true;
      return;
    }

    if (user.type === "monitor") {
      const editable = [".below18", ".violence", ".armedGroup", ".incidentRemarks"];
      row.querySelectorAll("input, select").forEach(el => {
        const isEditable = editable.some(cls => el.classList.contains(cls));
        el.disabled = !isEditable;
      });
      caseIdField.disabled = true;
      orgField.disabled = true;
      verifyStatus.disabled = true;
      verifyRemarks.disabled = true;
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
          <option ${data.below18 === "Yes" ? "selected" : ""}>Yes</option>
          <option ${data.below18 === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="violence">
          <option value="">-- Select --</option>
          <option ${data.violence === "Yes" ? "selected" : ""}>Yes</option>
          <option ${data.violence === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td>
        <select class="armedGroup">
          <option value="">-- Select --</option>
          <option ${data.armedgroup === "Yes" ? "selected" : ""}>Yes</option>
          <option ${data.armedgroup === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td><input type="text" class="incidentRemarks" value="${data.incidentremarks || ""}" placeholder="Remarks..."></td>
      <td>
        <select class="verifyStatus">
          <option value="">-- Select --</option>
          <option ${data.verifystatus === "Verified" ? "selected" : ""}>Verified</option>
          <option ${data.verifystatus === "Confirmed (to a reasonable level)" ? "selected" : ""}>Confirmed (to a reasonable level)</option>
          <option ${data.verifystatus === "Unverified" ? "selected" : ""}>Unverified</option>
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
  // ✅ Load Firestore Data (with Filter Support)
  // ==============================================
  async function loadFirestoreData() {
    try {
      const incidentsRef = collection(db, "incidents");
      let q;

      if (user.type === "admin") {
        q = incidentsRef;
      } else if (user.type === "supervisor") {
        q = query(incidentsRef, where("organisation", "==", user.organisation));
      } else if (user.type === "monitor") {
        q = query(incidentsRef, where("user_id", "==", user.id));
      }

      const snapshot = await getDocs(q);
      tableBody.innerHTML = "";

      snapshot.forEach(docSnap => {
        const data = docSnap.data();

        // Apply filter logic (client-side)
        const orgSelected = orgFilter.value;
        const userSelected = userFilter.value;

        if (user.type === "admin") {
          if (
            (orgSelected && data.organisation !== orgSelected) ||
            (userSelected && data.user_id !== userSelected)
          ) return;
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

  // Apply filter button
  applyFilterBtn?.addEventListener("click", async () => {
    await loadFirestoreData();
  });

  // ==============================================
  // ✅ Save Data (Admin only)
  // ==============================================
  document.getElementById("incidentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (user.type !== "admin") return;

    const incidents = [];
    document.querySelectorAll("#incidentBody tr").forEach(row => {
      incidents.push({
        case_id: row.querySelector(".case_id").value || `case_${Date.now()}`,
        user_id: row.querySelector(".user_id").value,
        organisation: row.querySelector(".organisation").value,
        below18: row.querySelector(".below18").value,
        violence: row.querySelector(".violence").value,
        armedgroup: row.querySelector(".armedGroup").value,
        incidentremarks: row.querySelector(".incidentRemarks").value,
        verifystatus: row.querySelector(".verifyStatus").value,
        verifyremarks: row.querySelector(".verifyRemarks").value
      });
    });

    try {
      for (const inc of incidents) {
        await setDoc(doc(db, "incidents", inc.case_id), inc);
      }
      message.style.color = "green";
      message.textContent = "✅ Data successfully saved to Firestore.";
    } catch (err) {
      console.error("❌ Save error:", err);
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
