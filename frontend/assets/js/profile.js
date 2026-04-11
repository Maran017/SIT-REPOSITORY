document.addEventListener("DOMContentLoaded", () => {
    const facultyID = localStorage.getItem("facultyID");
    const profileImg = document.getElementById("userProfileImg");
    const changePicBtn = document.getElementById("changePicBtn");
    const changePicInput = document.getElementById("changePicInput");
    const popup = document.getElementById("popup");

    // Position UI Elements
    const editPositionBtn = document.getElementById("editPositionBtn");
    const positionSelect = document.getElementById("positionSelect");
    const profilePositionText = document.getElementById("profilePosition");
    
    // Department UI Elements (Added)
    const editDeptBtn = document.getElementById("editDeptBtn");
    const deptSelect = document.getElementById("deptSelect");
    const profileDeptText = document.getElementById("profileDept");

    const statusBadge = document.getElementById("profileStatus");

    if (!facultyID) {
        window.location.href = "index.html";
        return;
    }

    // --- 1. NOTIFICATION SYSTEM ---
    function showNotification(message, type = "success") {
        if (!popup) return;
        popup.textContent = message;
        popup.style.display = "block";
        popup.style.backgroundColor = type === "success" ? "#d4edda" : "#f8d7da";
        popup.style.color = type === "success" ? "#155724" : "#721c24";
        popup.style.borderLeft = `6px solid ${type === "success" ? "#28a745" : "#dc3545"}`;
        setTimeout(() => { popup.style.display = "none"; }, 3000);
    }

    // --- 2. EDIT & REQUEST LOGIC (Updated for Dept) ---
    
    // Toggle Position UI
    if (editPositionBtn) {
        editPositionBtn.addEventListener("click", () => {
            const isHidden = positionSelect.style.display === "none" || positionSelect.style.display === "";
            positionSelect.style.display = isHidden ? "block" : "none";
        });
    }

    // Toggle Department UI
    if (editDeptBtn) {
        editDeptBtn.addEventListener("click", () => {
            const isHidden = deptSelect.style.display === "none" || deptSelect.style.display === "";
            deptSelect.style.display = isHidden ? "block" : "none";
        });
    }

    // Handle Position Request
    if (positionSelect) {
        positionSelect.addEventListener("change", () => {
            const requestedVal = positionSelect.value;
            if (!requestedVal) return;

            fetch('http://127.0.0.1:5000/auth/request-position-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    faculty_id: facultyID, 
                    new_position: requestedVal 
                })
            })
            .then(res => res.json())
            .then(data => {
                positionSelect.style.display = "none";
                showNotification(`Request to change position to "${requestedVal}" has been sent to Admin.`);
                positionSelect.selectedIndex = 0; 
            })
            .catch(err => {
                console.error("Position Request Error:", err);
                showNotification("Failed to send request", "error");
            });
        });
    }

    // Handle Department Request (Added)
    if (deptSelect) {
        deptSelect.addEventListener("change", () => {
            const requestedDept = deptSelect.value;
            if (!requestedDept) return;

            fetch('http://127.0.0.1:5000/auth/request-department-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    faculty_id: facultyID, 
                    new_department: requestedDept 
                })
            })
            .then(res => res.json())
            .then(data => {
                deptSelect.style.display = "none";
                showNotification(`Request for department change to "${requestedDept}" has been sent to Admin.`);
                deptSelect.selectedIndex = 0;
            })
            .catch(err => {
                console.error("Dept Request Error:", err);
                showNotification("Failed to send request", "error");
            });
        });
    }

    // --- 3. FETCH USER & PAPERS ---
    function loadProfile() {
        fetch(`http://127.0.0.1:5000/auth/user-details/${facultyID}`)
            .then(res => res.json())
            .then(user => {
                document.getElementById("profileName").textContent = user.name;
                document.getElementById("profileID").textContent = user.faculty_id;
                document.getElementById("profileEmail").textContent = user.email;
                
                // Set current values
                profileDeptText.textContent = user.department || "N/A";
                profilePositionText.textContent = user.position || "Faculty";
                
                // --- STATUS BADGE LOGIC ---
                if (statusBadge) {
                    const isActive = user.status === 'active'; 
                    statusBadge.textContent = isActive ? "ACTIVE" : "INACTIVE";
                    statusBadge.className = isActive ? "status-badge bg-success text-white" : "status-badge bg-danger text-white";
                }

                if (user.profile_pic) {
                    profileImg.src = user.profile_pic;
                    localStorage.setItem("userProfilePic", user.profile_pic);
                }

                const myPapers = user.papers || [];
                document.getElementById("paperCountBadge").textContent = `${myPapers.length} Papers`;

                renderPersonalPapers([...myPapers].reverse()); 
            })
            .catch(err => console.error("Error loading profile:", err));
    }

    // --- 4. PROFILE PICTURE LOGIC ---
    if (changePicBtn) {
        changePicBtn.addEventListener("click", (e) => {
            e.preventDefault();
            changePicInput.click();
        });
    }

    if (changePicInput) {
        changePicInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Pic = event.target.result;
                    profileImg.src = base64Pic;
                    localStorage.setItem("userProfilePic", base64Pic);

                    fetch('http://127.0.0.1:5000/auth/update-profile-pic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ faculty_id: facultyID, profile_pic: base64Pic })
                    })
                    .then(() => showNotification("Profile picture updated!"))
                    .catch(err => console.error("Error updating pic:", err));
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- 6. DELETE PAPER ---
    window.deletePaper = async function(paperId) {
        try {
            const response = await fetch('http://127.0.0.1:5000/auth/delete-paper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faculty_id: facultyID, file_id: paperId })
            });
            
            const data = await response.json();

            if (response.ok) {
                showNotification("Deletion request sent to Admin successfully", "info");
                loadProfile(); 
            } else {
                showNotification(data.message || "Delete failed", "error");
            }
        } catch (err) {
            showNotification("Server error", "error");
        }
    };

    // --- 5. RENDER PAPERS ---
    function renderPersonalPapers(papers) {
        const listContainer = document.getElementById("personalUploadsList");
        if (!listContainer) return;

        if (papers.length === 0) {
            listContainer.innerHTML = '<p class="text-muted text-center py-3">No papers uploaded yet.</p>';
            return;
        }

        listContainer.innerHTML = papers.map(paper => {
            const isPending = paper.pending_deletion === true;

            return `
                <div class="card mb-2 shadow-sm border-0 ${isPending ? 'bg-light opacity-75' : 'bg-white'}">
                    <div class="card-body d-flex justify-content-between align-items-center py-2">
                        <div style="flex: 1; padding-right: 15px;">
                            <span class="fw-bold ${isPending ? 'text-muted' : 'text-dark'}" style="font-size: 0.95rem;">
                                ${paper.title} 
                                ${isPending ? '<span class="badge bg-warning text-dark ms-2" style="font-size: 0.7rem;">Pending Deletion</span>' : ''}
                            </span>
                            <br>
                            <small class="text-muted">
                                ${paper.domain} | ${paper.journal_name || 'N/A'} | Vol: ${paper.volume || 'N/A'} | Year: ${paper.year}
                            </small>
                        </div>
                        <div class="d-flex gap-2">
                            <a href="http://127.0.0.1:5000/auth/view-pdf/${paper.file_id}?download=true" 
                               class="btn btn-sm btn-outline-success ${isPending ? 'disabled' : ''}">Download</a>
                            
                            ${isPending ? 
                                `<button class="btn btn-sm btn-secondary disabled" title="Waiting for Admin">Requested</button>` : 
                                `<button class="btn btn-sm btn-outline-danger" onclick="deletePaper('${paper.file_id}')">Delete</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadProfile();
});