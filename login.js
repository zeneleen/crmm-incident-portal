document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("msg");

  try {
    const response = await fetch("./users.json");
    if (!response.ok) throw new Error("Failed to load user data");

    const users = await response.json();
    const matchedUser = users.find(user => user.id === username && user.password === password);

    if (matchedUser) {
      msg.style.color = "green";
      msg.textContent = "Login successful! Redirecting...";
      console.log("Matched user:", matchedUser);

      localStorage.setItem("loggedInUser", JSON.stringify(matchedUser));
      console.log("Stored user:", localStorage.getItem("loggedInUser"));

      setTimeout(() => {
        window.location.replace("Incident.html");
      }, 800);
    } else {
      msg.style.color = "red";
      msg.textContent = "Invalid User ID or Password.";
    }
  } catch (error) {
    console.error("Error loading users.json:", error);
    msg.style.color = "red";
    msg.textContent = "Unable to load user data. Please contact admin.";
  }
});
