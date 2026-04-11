document.addEventListener("DOMContentLoaded", () => {
    const papersStack = document.getElementById("papersStack"); 
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");
    const filterItems = document.querySelectorAll(".dropdown-item");
    const filterLabel = document.getElementById("filterLabel");
    const popup = document.getElementById('popup');

    let allPapers = []; 
    let currentFilter = "title"; 

    // --- 1. WELCOME NOTIFICATION LOGIC ---
    const loginMsg = localStorage.getItem('loginSuccessMsg');
    if (loginMsg && popup) {
        popup.innerText = loginMsg;
        popup.style.display = 'block';
        
        // Dynamic Styling for Success
        popup.style.backgroundColor = "#d4edda";
        popup.style.color = "#155724";
        popup.style.border = "1px solid #c3e6cb";

        // Remove from storage so it doesn't show again on refresh
        localStorage.removeItem('loginSuccessMsg');

        // Hide after 3 seconds
        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }

    // --- 2. FETCH DATA FROM BACKEND ---
    function fetchPapers() {
        fetch('http://127.0.0.1:5000/auth/all-papers')
            .then(res => res.json())
            .then(data => {
                // Sort by creation date descending to show newest first
                allPapers = data.sort((a, b) => {
                    return new Date(b.created_at) - new Date(a.created_at);
                }); 
                renderPapers(allPapers);
            })
            .catch(err => {
                console.error("Fetch Error:", err);
                if (papersStack) {
                    papersStack.innerHTML = '<p class="text-center mt-5">Server Connection Failed.</p>';
                }
            });
    }

    // --- 3. FILTER UI TOGGLE ---
    filterItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            currentFilter = item.getAttribute("data-filter");
            filterLabel.textContent = item.textContent;
            performSearch();
        });
    });

    // --- 4. SEARCH LOGIC ---
    function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    
    const filtered = allPapers.filter(paper => {
        // 1. Handle specialized Type-only filters
        if (currentFilter === "journal") return paper.pub_type === "Journal";
        if (currentFilter === "conference") return paper.pub_type === "Conference";

        // 2. Handle the searchable fields
        // Note: paper['journal_name'] and paper['keywords'] are now handled here
        const val = paper[currentFilter] ? paper[currentFilter].toString().toLowerCase() : "";
        
        // This 'includes' check is perfect for keywords! 
        // If query is "AI", it will find it in "Machine Learning/AI/Data"
        return val.includes(query);
    });

    renderPapers(filtered);
    }

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("input", performSearch);

// --- 5. MAIN RENDER FUNCTION (Optimized with Perfect Backend Mapping) ---
    function renderPapers(papers) {
        if (!papersStack) return;
        
        if (papers.length === 0) {
            papersStack.innerHTML = '<div class="text-center p-5 text-muted">No records found.</div>';
            return;
        }

        papersStack.innerHTML = papers.map(paper => {
            // 1. TYPE INDICATOR LOGIC: Ensures 'Journal' gets blue branding, others get black
            const typeText = paper.pub_type || "PUBLICATION";
            const isJournal = typeText === "Journal";
            const typeClass = isJournal ? "type-journal" : "type-conference";

            // 2. ADMIN STATUS REPLICATION: Visual sync with Admin dashboard decisions
            const isUserActive = paper.user_status === 'active';
            const statusColor = isUserActive ? "active-text" : "inactive-text";
            const statusValue = isUserActive ? "ACTIVE" : "INACTIVE";

            return `
            <div class="paper-card">
                <div class="paper-main-content">
                    <span class="paper-title">${paper.title.toUpperCase()}</span>
                    
                    <div class="paper-details">
                        <div class="mb-1">
                            <span class="detail-bold">Author:</span> ${paper.author_name} | 
                            <span class="detail-bold">Dept:</span> ${paper.department}
                        </div>
                        <div class="mb-1">
                            <span class="detail-bold">Domain:</span> ${paper.domain} | 
                            <span class="detail-bold">Year:</span> ${paper.year}
                        </div>
                        <div class="journal-details-row">
                            <span class="detail-bold">Journal:</span> ${paper.journal_name || 'N/A'} | 
                            <span class="detail-bold">Vol:</span> ${paper.volume || 'N/A'} | 
                            <span class="detail-bold">Page:</span> ${paper.page_number || 'N/A'}
                        </div>
                    </div>
                    
                    <p class="keywords-text">Keywords: ${paper.keywords || 'N/A'}</p>
                </div>

                <div class="paper-actions">
                    <div class="type-indicator ${typeClass}">${typeText.toUpperCase()}</div>
                    
                    <a href="http://127.0.0.1:5000/auth/view-pdf/${paper.file_id}?download=true" 
                       class="btn btn-sm btn-primary w-100 mb-1" style="font-size: 0.7rem; font-weight:700;">download</a>
                    
                    <a href="http://127.0.0.1:5000/auth/view-pdf/${paper.file_id}" 
                       target="_blank" 
                       class="btn btn-sm btn-outline-primary w-100" style="font-size: 0.7rem; font-weight:700;">view</a>
                </div>

                <div class="author-sidebar">
                    <div class="status-container">
                        STATUS: <span class="${statusColor}">${statusValue}</span>
                    </div>
                    <img src="${paper.profile_pic || '../assets/images/default-user.png'}" 
                         class="author-img" 
                         alt="Author"
                         onerror="this.src='../assets/images/default-user.png';">
                </div>
            </div>
            `;
        }).join('');
    }
    
    // --- 6. SYNC NAV PROFILE PICTURE ---
    window.addEventListener('storage', (event) => {
        if (event.key === 'userProfilePic' && event.newValue) {
            const navPic = document.getElementById("navProfilePic");
            if (navPic) {
                navPic.src = event.newValue;
            }
        }
    });

    // --- 7. ADMIN VS FACULTY ROLE UI SETUP ---
    const userRole = localStorage.getItem("userRole");
    const navPic = document.getElementById("navProfilePic");
    const profileLink = document.getElementById("profileLink");

    if (userRole === "admin") {
        // Force SIT Logo for Admin
        if (navPic) navPic.src = "../assets/images/logo.png";
        // Redirect Admin to admin.html
        if (profileLink) profileLink.href = "admin.html";
    } else {
        // Set Faculty's Profile Pic
        if (navPic) {
            navPic.src = localStorage.getItem("userProfilePic") || "../assets/images/default-user.png";
        }
        // Redirect Faculty to profile.html
        if (profileLink) profileLink.href = "profile.html";
    }

    // Run initial fetch
    fetchPapers();

    // Auto-refresh feed every 60 seconds to catch Admin status changes without manual reload
    setInterval(fetchPapers, 60000);
});