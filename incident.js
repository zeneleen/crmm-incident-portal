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

  // === Load users.json ===
  const response = await fetch("users.json");
  const users = await response.json();

  // === Show Add button only for admin ===
  addRowBtn.style.display = user.type === "admin" ? "inline-block" : "none";

  // === Disable submit for non-admin ===
  if (user.type !== "admin") {
    document.getElementById("incidentForm").querySelector("button[type='submit']").disabled = true;
  }

  // ==============================================
  // ✅ Populate user dropdown
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
  // ✅ Auto-update organisation when user changes
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
      orgField.disabled = true;
      verifyStatus.disabled = true;
      verifyRemarks.disabled = true;
    }
  };

  // ==============================================
  // ✅ Normalize Firestore Data
  // ==============================================
  function normalizeFirestoreData(docData) {
    if (!docData) return {};
    const clean = {};
    Object.entries(docData).forEach(([key, val]) => {
      clean[key.toLowerCase()] = val?.stringValue ?? val ?? "";
    });
    return clean;
  }

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
    const select = newRow.querySelector(".user_id");
    populateUserDropdown(select, data.user_id);
    linkUserToOrganisation(newRow);
    setAccessByRole(newRow);
  };

  // ==============================================
  // ✅ Load Firestore Data (STRICT visibility)
  // ==============================================
  async function loadFirestoreData() {
    try {
      let q;
      const incidentsRef = collection(db, "incidents");

      if (user.type === "admin") {
        q = incidentsRef;
      } else if (user.type === "supervisor") {
        q = query(
          incidentsRef,
          where("organisation", "in", [
            user.organisation,
            user.organisation.toUpperCase(),
            user.organisation.toLowerCase()
          ])
        );
      } else if (user.type === "monitor") {
        q = query(incidentsRef, where("user_id", "==", user.id));
      }

      const snapshot = await getDocs(q);
      tableBody.innerHTML = "";
      let visibleCount = 0;

      snapshot.forEach(docSnap => {
        const cleanData = normalizeFirestoreData(docSnap.data());
        if (!cleanData.user_id || !cleanData.organisation) return;

        // 🔒 Strict visibility check
        if (
          user.type === "supervisor" &&
          cleanData.organisation.trim().toLowerCase() !== user.organisation.trim().toLowerCase()
        )
          return;

        if (
          user.type === "monitor" &&
          cleanData.user_id.trim().toLowerCase() !== user.id.trim().toLowerCase()
        )
          return;

        addNewRow(cleanData);
        visibleCount++;
      });

      message.style.color = "green";
      message.textContent = `✅ Data loaded for ${user.type} (${visibleCount} records visible).`;

      if (visibleCount === 0) {
        message.textContent += " No records found for your organisation.";
      }
    } catch (err) {
      console.error("⚠️ Firestore load failed:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Could not load data from Firestore.";
    }
  }

  await loadFirestoreData();

  // ==============================================
  // ✅ Save Updated Data
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
