document.addEventListener("DOMContentLoaded", () => {
    // --- 1. UI ELEMENTS ---
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");
    const popup = document.getElementById("popup");
    const profileInput = document.getElementById("profileInput");
    const displayArea = document.querySelector(".profile-pic-display");

    // --- 2. UNIFIED NOTIFICATION SYSTEM ---
    function showNotification(message, type = "success") {
        if (!popup) return;
        popup.textContent = message;
        popup.style.display = "block";

        if (type === "success") {
            popup.style.color = "#008000";
            popup.style.borderLeft = "6px solid #008000";
        } else {
            popup.style.color = "#d9534f"; // Red for errors
            popup.style.borderLeft = "6px solid #d9534f";
        }

        setTimeout(() => {
            popup.style.display = "none";
        }, 3000);
    }

    // Check for messages left by other pages (like after account deletion)
    const deleteMsg = localStorage.getItem('deleteSuccessMsg');
    if (deleteMsg) {
        showNotification(deleteMsg, "success");
        localStorage.removeItem('deleteSuccessMsg');
    }

    // --- 3. PROFILE PICTURE PREVIEW ---
    if (profileInput && displayArea) {
        profileInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    displayArea.innerHTML = `<img src="${event.target.result}" 
                        style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- 4. REGISTRATION LOGIC (FIXED) ---
    if (registerForm) {
        registerForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const name = document.getElementById("name").value.trim();
            const facultyId = document.getElementById("facultyId").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const repassword = document.getElementById("repassword").value;
            const department = document.getElementById("department").value;
            
            // 1. ADD THIS LINE to grab the selected position from your HTML
            // (Make sure the ID 'position' matches your <select> tag in register.html)
            const position = document.getElementById("position").value;

            const profileImgElement = displayArea.querySelector("img");
            const profilePicData = profileImgElement ? profileImgElement.src : ""; 

            // 2. Add 'position' to your validation check
            if (!name || !facultyId || !email || !password || !department || !position) {
                showNotification("Please enter all details", "error");
                return;
            }

            if (password !== repassword) {
                showNotification("Passwords do not match", "error");
                return;
            }

            const userData = {
                name: name,
                faculty_id: facultyId,
                email: email,
                password: password,
                department: department,
                profile_pic: profilePicData,
                position: position // 3. FIXED: Changed from "Faculty" to the variable
            };

            fetch('http://localhost:5000/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                return data;
            })
            .then(data => {
                showNotification("Registration request sent to Admin for approval", "success");
                registerForm.reset();
                setTimeout(() => { window.location.href = "index.html"; }, 3000);
            })
            .catch((error) => {
                showNotification(error.message || "Server error", "error");
            });
        });
    }

    // --- 5. LOGIN LOGIC ---
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            
            const facultyIdInput = document.getElementById("loginFacultyId").value.trim();
            const passwordInput = document.getElementById("loginPassword").value;

            fetch('http://localhost:5000/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    faculty_id: facultyIdInput, 
                    password: passwordInput 
                }),
            })
            .then(async response => {
                const data = await response.json();
                
                if (response.status === 403) {
                    showNotification(data.message, "warning");
                    return null; 
                }

                if (!response.ok) {
                    throw new Error(data.message || "Invalid credentials");
                }
                return data;
            })
            .then(data => {
                if (!data || !data.user) return;

                // --- UNIFIED DATA STORAGE ---
                // We use "facultyID" (capital ID) to match what your other pages expect
                localStorage.setItem("userRole", data.user.role); 
                localStorage.setItem("facultyName", data.user.name);
                localStorage.setItem("facultyID", data.user.faculty_id);
                localStorage.setItem("userProfilePic", data.user.profile_pic);
                
                localStorage.setItem('loginSuccessMsg', `Welcome, ${data.user.name}!`);
                
                // --- DELAYED REDIRECT ---
                // 100ms delay ensures localStorage is finished writing
                setTimeout(() => {
                    if (data.user.role === "admin") {
                        window.location.replace("admin.html");
                    } else {
                        window.location.replace("dashboard.html");
                    }
                }, 100);
            })
            .catch((error) => {
                console.error("Login Error:", error);
                showNotification(error.message, "error");
            });
        });
    }
});