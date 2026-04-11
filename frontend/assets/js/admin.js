document.addEventListener("DOMContentLoaded", () => {
    // 1. FRONTEND SECURITY CHECK
    if (localStorage.getItem("userRole") !== "admin") {
        window.location.href = "index.html"; 
        return;
    }

    const adminId = localStorage.getItem("facultyID"); 
    const allProfilesTable = document.getElementById("allProfilesTable");
    const profileSearch = document.getElementById("profileSearch");
    
    // Notification Box Containers
    const accountRequestsDiv = document.getElementById("account-requests");
    const positionRequestsDiv = document.getElementById("position-requests");
    const deletionRequestsDiv = document.getElementById("deletion-requests");
    const deptRequestsDiv = document.getElementById("department-requests"); // Added for Dept Change

    // --- 2. FETCH ALL DATA ---
    function loadAdminData() {
        fetch('http://127.0.0.1:5000/auth/admin-stats', {
            headers: { 'X-Admin-ID': adminId }
        })
        .then(res => {
            if (res.status === 403) {
                localStorage.clear();
                window.location.href = "index.html";
                return;
            }
            return res.json();
        })
        .then(data => {
            if (!data) return;

            // 1. Update the Main Faculty Profiles Table
            renderProfiles(data.profiles);

            // 2. Update Department Profile Stats
            if (typeof renderDepartmentStats === "function") {
                renderDepartmentStats(data.deptStats);
            }

            // 3. Update Department Paper Stats
            if (typeof renderDepartmentPaperStats === "function") {
                renderDepartmentPaperStats(data.paperStats);
            }
            
            // 4. Update ALL 4 Notification Boxes
            renderAccountRequests(data.requests.accounts);
            renderPositionRequests(data.requests.positions);
            renderDeletionRequests(data.requests.deletions);
            renderDepartmentRequests(data.requests.departments); // Added
        })
        .catch(err => console.error("Admin Stats Fetch Error:", err));
    }

    // --- 3. RENDER FACULTY PROFILES ---
    function renderProfiles(profiles) {
        if (!allProfilesTable) return;
        allProfilesTable.innerHTML = profiles.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.faculty_id}</td>
                <td>${user.department}</td>
                <td>${user.paper_count}</td>
                <td>${user.position || 'Faculty'}</td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" 
                            ${user.status === 'active' ? 'checked' : ''} 
                            onchange="toggleStatus('${user.faculty_id}', this.checked)">
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.faculty_id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // --- 4. NOTIFICATION BOX: ACCOUNTS ---
    function renderAccountRequests(users) {
        if (!accountRequestsDiv) return;
        if (!users || users.length === 0) {
            accountRequestsDiv.innerHTML = `<p class="text-muted small ms-2">No pending requests</p>`;
            return;
        }
        accountRequestsDiv.innerHTML = users.map(user => `
            <div class="card mb-2 shadow-sm border-0 border-start border-success border-4" style="background: #ffffff;">
                <div class="card-body d-flex justify-content-between align-items-center py-2 px-3">
                    <div style="flex: 1;">
                        <span class="fw-bold text-primary" style="font-size: 0.9rem;">${user.name}</span>
                        <span class="badge bg-info text-dark ms-1">${user.position || user.role || "Faculty"}</span>
                        <span class="text-muted small">(${user.faculty_id})</span>
                        <br>
                        <small class="text-dark">Dept: <span class="fw-semibold">${user.department}</span></small>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-success" onclick="handleRegistration('${user.faculty_id}', 'approve')">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="handleRegistration('${user.faculty_id}', 'decline')">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 5. NOTIFICATION BOX: POSITIONS ---
    function renderPositionRequests(users) {
        if (!positionRequestsDiv) return;
        if (!users || users.length === 0) {
            positionRequestsDiv.innerHTML = `<p class="text-muted small ms-2">No position requests</p>`;
            return;
        }
        positionRequestsDiv.innerHTML = users.map(user => `
            <div class="notif-box shadow-sm mb-2" style="border-left: 4px solid #198754; padding: 10px; background: #f8f9fa;">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="font-size: 0.85rem; line-height: 1.4;">
                        <strong>${user.name}</strong> from <strong>${user.department}</strong> 
                        requested position change: 
                        <span class="badge bg-secondary">${user.current_position}</span> → 
                        <span class="badge bg-primary">${user.new_position}</span>
                    </div>
                    <div class="d-flex gap-1 ms-2">
                        <button class="btn btn-sm btn-success p-1" onclick="handlePositionDecision('${user.faculty_id}', 'approve')">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger p-1" onclick="handlePositionDecision('${user.faculty_id}', 'decline')">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 6. NOTIFICATION BOX: DEPARTMENTS (New Addition) ---
    function renderDepartmentRequests(users) {
        if (!deptRequestsDiv) return;
        if (!users || users.length === 0) {
            deptRequestsDiv.innerHTML = `<p class="text-muted small ms-2">No department requests</p>`;
            return;
        }
        deptRequestsDiv.innerHTML = users.map(user => `
            <div class="notif-box shadow-sm mb-2" style="border-left: 4px solid #198754; padding: 10px; background: #f8f9fa;">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="font-size: 0.85rem; line-height: 1.4;">
                        <strong>${user.position} ${user.name}</strong> 
                        requested department change: 
                        <span class="badge bg-secondary">${user.current_department}</span> → 
                        <span class="badge bg-primary">${user.new_department}</span>
                    </div>
                    <div class="d-flex gap-1 ms-2">
                        <button class="btn btn-sm btn-success p-1" onclick="handleDeptDecision('${user.faculty_id}', 'approve')">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger p-1" onclick="handleDeptDecision('${user.faculty_id}', 'decline')">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 7. NOTIFICATION BOX: PAPER DELETIONS ---
    function renderDeletionRequests(requests) {
        if (!deletionRequestsDiv) return;
        if (!requests || requests.length === 0) {
            deletionRequestsDiv.innerHTML = `<p class="text-muted small ms-2">No deletion requests</p>`;
            return;
        }
        deletionRequestsDiv.innerHTML = requests.map(req => `
            <div class="notif-box shadow-sm mb-2" style="border-left: 4px solid #dc3545; padding: 10px; background: #f8f9fa;">
                <div class="d-flex justify-content-between align-items-start">
                    <div style="font-size: 0.85rem; line-height: 1.4;">
                        <span class="text-primary fw-bold">${req.position} ${req.name}</span> 
                        wants to delete <span class="text-danger fw-bold">"${req.paper_title}"</span>
                    </div>
                    <div class="d-flex gap-1 ms-2">
                        <button class="btn btn-sm btn-success p-1" onclick="handlePaperDeletion('${req.faculty_id}', '${req.file_id}', 'approve')">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger p-1" onclick="handlePaperDeletion('${req.faculty_id}', '${req.file_id}', 'decline')">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 8. SEARCH FILTER ---
    if (profileSearch) {
        profileSearch.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const rows = allProfilesTable.querySelectorAll("tr");
            rows.forEach(row => {
                const name = row.cells[0].textContent.toLowerCase();
                row.style.display = name.includes(term) ? "" : "none";
            });
        });
    }

    window.loadAdminData = loadAdminData;
    loadAdminData();
    setInterval(loadAdminData, 30000); 
});

// --- GLOBAL ACTIONS ---

function handleRegistration(facultyId, action) {
    const adminId = localStorage.getItem("facultyID");
    fetch('http://127.0.0.1:5000/auth/handle-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId, action: action })
    })
    .then(() => { if (window.loadAdminData) window.loadAdminData(); })
    .catch(err => console.error("Registration Error:", err));
}

function toggleStatus(facultyId, isChecked) {
    const adminId = localStorage.getItem("facultyID");
    const statusValue = isChecked ? 'active' : 'inactive';
    fetch('http://127.0.0.1:5000/auth/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId, status: statusValue })
    })
    .then(() => { if (window.loadAdminData) window.loadAdminData(); })
    .catch(err => console.error("Toggle Error:", err));
}

function handlePositionDecision(facultyId, action) {
    const adminId = localStorage.getItem("facultyID");
    fetch('http://127.0.0.1:5000/auth/handle-position-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId, action: action })
    })
    .then(() => { if (window.loadAdminData) window.loadAdminData(); })
    .catch(err => console.error("Position Decision Error:", err));
}

// Added for Department Changes
function handleDeptDecision(facultyId, action) {
    const adminId = localStorage.getItem("facultyID");
    fetch('http://127.0.0.1:5000/auth/handle-department-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId, action: action })
    })
    .then(() => { if (window.loadAdminData) window.loadAdminData(); })
    .catch(err => console.error("Dept Decision Error:", err));
}

function handlePaperDeletion(facultyId, fileId, action) {
    const adminId = localStorage.getItem("facultyID");
    fetch('http://127.0.0.1:5000/auth/handle-paper-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId, file_id: fileId, action: action })
    })
    .then(() => { if (window.loadAdminData) window.loadAdminData(); })
    .catch(err => console.error("Paper Deletion Error:", err));
}

function deleteUser(facultyId) {
    if (!confirm(`Are you sure you want to permanently delete faculty ${facultyId}?`)) return;
    const adminId = localStorage.getItem("facultyID");
    fetch('http://127.0.0.1:5000/auth/delete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-ID': adminId },
        body: JSON.stringify({ faculty_id: facultyId })
    })
    .then(res => {
        if (res.ok) {
            alert("Profile deleted successfully.");
            loadAdminData();
        }
    })
    .catch(err => console.error("Delete User Error:", err));
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

function renderDepartmentStats(stats) {
    const deptTable = document.getElementById("deptProfileCount");
    if (!deptTable) return;
    deptTable.innerHTML = stats.map(s => `
        <tr>
            <td>${s.dept}</td>
            <td>${s.total}</td>
            <td class="text-success fw-bold">${s.active}</td>
            <td class="text-danger fw-bold">${s.inactive}</td>
        </tr>
    `).join('');
}

function renderDepartmentPaperStats(stats) {
    const paperTableBody = document.getElementById("deptPaperCount");
    if (!paperTableBody || !stats) return;
    paperTableBody.innerHTML = stats.map(s => `
        <tr>
            <td>${s.dept}</td>
            <td class="fw-bold text-success">${s.total}</td>
            <td class="fw-bold text-primary">${s.journals}</td>
            <td class="fw-bold text-dark">${s.conferences}</td>
        </tr>
    `).join('');
}