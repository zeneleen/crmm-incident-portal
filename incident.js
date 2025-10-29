// ==============================================
// ✅ Firebase Setup
// ==============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, setDoc, doc
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
// ✅ Main Logic
// ==============================================
document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please login first.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("userInfo").textContent =
    `Logged in as: ${user.id} (${user.organisation} | ${user.type})`;

  const tableBody = document.getElementById("incidentBody");
  const addRowBtn = document.getElementById("addRowBtn");
  const message = document.getElementById("message");
  const filterUser = document.getElementById("filterUser");
  const filterOrg = document.getElementById("filterOrg");

  // === Load users.json ===
  const response = await fetch("users.json");
  const users = await response.json();

  // === Admin can add rows ===
  addRowBtn.style.display = user.type === "admin" ? "inline-block" : "none";

  // ==============================================
  // ✅ Populate user dropdown (based on role)
  // ==============================================
  const populateUserDropdown = (select, preselectedUserId = "") => {
    select.innerHTML = "";
    let availableUsers = users;

    if (user.type === "supervisor")
      availableUsers = users.filter(u => u.organisation === user.organisation);
    else if (user.type === "monitor")
      availableUsers = [user];

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
  // ✅ Auto link user_id → organisation
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
  // ✅ Role-based field access
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
      row.querySelectorAll("input, select").forEach(el => el.disabled = true);
      row.querySelector(".below18").disabled = false;
      row.querySelector(".violence").disabled = false;
      row.querySelector(".armedGroup").disabled = false;
      row.querySelector(".incidentRemarks").disabled = false;
    }
  };

  // ==============================================
  // ✅ Add new row to table
  // ==============================================
  const addRow = (data = {}) => {
    const row = document.createElement("tr");
    row.innerHTML = `
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
          <option ${data.armedGroup === "Yes" ? "selected" : ""}>Yes</option>
          <option ${data.armedGroup === "No" ? "selected" : ""}>No</option>
        </select>
      </td>
      <td><input type="text" class="incidentRemarks" value="${data.incidentRemarks || ""}"></td>
      <td>
        <select class="verifyStatus">
          <option value="">-- Select --</option>
          <option ${data.verifyStatus === "Verified" ? "selected" : ""}>Verified</option>
          <option ${data.verifyStatus === "Confirmed (to a reasonable level)" ? "selected" : ""}>Confirmed (to a reasonable level)</option>
          <option ${data.verifyStatus === "Unverified" ? "selected" : ""}>Unverified</option>
        </select>
      </td>
      <td><input type="text" class="verifyRemarks" value="${data.verifyRemarks || ""}"></td>
    `;
    tableBody.appendChild(row);

    const select = row.querySelector(".user_id");
    populateUserDropdown(select, data.user_id);
    linkUserToOrganisation(row);
    setAccessByRole(row);
  };

  addRowBtn.addEventListener("click", () => addRow());

  // ==============================================
  // ✅ Load Firestore data
  // ==============================================
  async function loadFirestoreData() {
    try {
      let q;
      if (user.type === "admin")
        q = collection(db, "incidents");
      else if (user.type === "supervisor")
        q = query(collection(db, "incidents"), where("organisation", "==", user.organisation));
      else if (user.type === "monitor")
        q = query(collection(db, "incidents"), where("user_id", "==", user.id));

      const snapshot = await getDocs(q);
      tableBody.innerHTML = "";
      snapshot.forEach(docSnap => addRow(docSnap.data()));

      message.style.color = "green";
      message.textContent = `✅ Data loaded for ${user.type}`;
    } catch (err) {
      console.error("Firestore load failed:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Could not load data from Firestore.";
    }
  }

  await loadFirestoreData();

  // ==============================================
  // ✅ Save data to Firestore
  // ==============================================
  document.getElementById("incidentForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const incidents = [];
    document.querySelectorAll("#incidentBody tr").forEach(row => {
      incidents.push({
        case_id: row.querySelector(".case_id").value || `case_${Date.now()}`,
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

    try {
      for (const inc of incidents) {
        await setDoc(doc(db, "incidents", inc.case_id), inc);
      }
      message.style.color = "green";
      message.textContent = "✅ Data successfully saved to Firestore.";
    } catch (err) {
      console.error("Save error:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Failed to save data to Firestore.";
    }
  });

  // ==============================================
  // ✅ Populate filter dropdowns
  // ==============================================
  const allUsers = [...new Set(users.map(u => u.id))];
  const allOrgs = [...new Set(users.map(u => u.organisation))];

  allUsers.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    filterUser.appendChild(opt);
  });

  allOrgs.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    filterOrg.appendChild(opt);
  });

  // ==============================================
  // ✅ Filter function (live table filtering)
  // ==============================================
  function applyFilters() {
    const selectedUser = filterUser.value.trim().toLowerCase();
    const selectedOrg = filterOrg.value.trim().toLowerCase();

    document.querySelectorAll("#incidentBody tr").forEach(row => {
      const userVal = row.querySelector(".user_id").value.trim().toLowerCase();
      const orgVal = row.querySelector(".organisation").value.trim().toLowerCase();

      const matchUser = !selectedUser || userVal === selectedUser;
      const matchOrg = !selectedOrg || orgVal === selectedOrg;

      row.style.display = matchUser && matchOrg ? "" : "none";
    });
  }

  filterUser.addEventListener("change", applyFilters);
  filterOrg.addEventListener("change", applyFilters);

  // ==============================================
  // ✅ Logout
  // ==============================================
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.replace("index.html");
  });
});
