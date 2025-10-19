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

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDP1uofFj_RHYZWLprN4P613UyXgi1suM30",
  authDomain: "crmm-cxb.firebaseapp.com",
  projectId: "crmm-cxb",
  storageBucket: "crmm-cxb.appspot.com",
  messagingSenderId: "920459967885",
  appId: "1:920459967885:web:402c2800ebe786ee5391c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === Main Script ===
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

  addRowBtn.style.display = user.type === "admin" ? "inline-block" : "none";

  // === Populate user dropdown ===
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
    if (preselectedUserId) {
      select.value = preselectedUserId;
    } else if (user.type === "monitor") {
      select.value = user.id;
    }
  };

  // === Auto-update organisation field ===
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

  // === Access control by role ===
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

  // === Add a new blank row ===
  const addNewRow = () => {
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><input type="text" class="case_id" placeholder="Auto ID"></td>
      <td><select class="user_id"></select></td>
      <td><input type="text" class="organisation" disabled></td>
      <td>
        <select class="below18">
          <option value="">-- Select --</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </td>
      <td>
        <select class="violence">
          <option value="">-- Select --</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </td>
      <td>
        <select class="armedGroup">
          <option value="">-- Select --</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </td>
      <td><input type="text" class="incidentRemarks" placeholder="Remarks..."></td>
      <td>
        <select class="verifyStatus">
          <option value="">-- Select --</option>
          <option>Verified</option>
          <option>Confirmed (to a reasonable level)</option>
          <option>Unverified</option>
        </select>
      </td>
      <td><input type="text" class="verifyRemarks" placeholder="Verification notes..."></td>
    `;
    tableBody.appendChild(newRow);
    const select = newRow.querySelector(".user_id");
    populateUserDropdown(select);
    linkUserToOrganisation(newRow);
    setAccessByRole(newRow);
  };
  addRowBtn.addEventListener("click", addNewRow);

  // === Load data from Firestore (role-based) ===
  async function loadFirestoreData() {
    try {
      let q;
      if (user.type === "admin") {
        q = collection(db, "incidents");
      } else if (user.type === "supervisor") {
        q = query(collection(db, "incidents"), where("organisation", "==", user.organisation));
      } else if (user.type === "monitor") {
        q = query(collection(db, "incidents"), where("user_id", "==", user.id));
      }

      const snapshot = await getDocs(q);
      tableBody.innerHTML = "";

      snapshot.forEach(docSnap => {
        const entry = docSnap.data();
        const row = document.createElement("tr");
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
        const select = row.querySelector(".user_id");
        populateUserDropdown(select, entry.user_id);
        linkUserToOrganisation(row);
        setAccessByRole(row);
        tableBody.appendChild(row);
      });

      message.style.color = "green";
      message.textContent = `✅ Data loaded for ${user.type}`;
    } catch (err) {
      console.error("Firestore load failed:", err);
      message.style.color = "red";
      message.textContent = "⚠️ Could not load data from Firestore.";
    }
  }

  await loadFirestoreData();

  // === Submit and save data to Firestore ===
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
      for (const incident of incidents) {
        await setDoc(doc(db, "incidents", incident.case_id), incident);
      }
      message.style.color = "green";
      message.textContent = "✅ Data successfully saved to Firestore.";
    } catch (err) {
      console.error("Save error:", err);
      message.style.color = "red";
      message.textContent = "❌ Failed to save data to Firestore.";
    }
  });

  // === Logout ===
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.replace("index.html");
  });
});
