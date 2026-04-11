import os
import subprocess
import uuid
import secrets  # For generating random password
import smtplib  # For sending the email
from email.mime.text import MIMEText
from flask import Blueprint, request, jsonify, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from models.User import users_collection, create_user_template
from datetime import datetime
from os import getenv
from flask import abort
from dotenv import load_dotenv # 1. Import this

# 2. LOAD THE .ENV FILE IMMEDIATELY
load_dotenv()

auth_bp = Blueprint('auth', __name__)

# --- ADMIN CREDENTIALS ---
ADMIN_USERNAME = getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = getenv("ADMIN_PASSWORD")

# --- GMAIL CONFIGURATION ---
GMAIL_USER = "mailsample2026@gmail.com"
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD") # PASTE YOUR APP PASSWORD HERE

def verify_admin():
    # We check for a custom header we will send from JS
    admin_id = request.headers.get("X-Admin-ID")
    if admin_id != os.getenv("ADMIN_USERNAME"):
        abort(403) # Forbidden

# Folder Setup
UPLOAD_FOLDER = 'uploads'
TEMP_FOLDER = 'temp_storage'
for folder in [UPLOAD_FOLDER, TEMP_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)

# --- GHOSTSCRIPT COMPRESSOR ---
def compress_pdf(input_path, output_path):
    gs_command = [
        "gswin64c", 
        "-sDEVICE=pdfwrite", 
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook", 
        "-dNOPAUSE", 
        "-dQUIET", 
        "-dBATCH",
        f"-sOutputFile={output_path}", 
        input_path
    ]
    subprocess.run(gs_command, check=True)

# --- VIEW & DOWNLOAD PDF ---
@auth_bp.route('/view-pdf/<fid>', methods=['GET'])
def view_pdf(fid):
    is_download = request.args.get('download') == 'true'
    user = users_collection.find_one({"papers.file_id": fid}, {"papers.$": 1})
    if not user:
        return jsonify({"message": "Paper not found"}), 404
    
    paper = user['papers'][0]
    file_path = paper.get('file_url')
    
    if not os.path.exists(file_path):
        return jsonify({"message": "Physical file missing on server"}), 404

    return send_file(
        os.path.abspath(file_path),
        as_attachment=is_download,
        download_name=f"{paper['title']}.pdf" 
    )

# --- UPLOAD PAPER ---
@auth_bp.route('/upload-paper', methods=['POST'])
def upload_paper():
    # 1. CAPTURE ALL INCOMING DATA
    faculty_id = request.form.get('faculty_id')
    title = request.form.get('title')
    journal_name = request.form.get('journal_name')  # NEW: Added
    domain = request.form.get('domain')
    keywords = request.form.get('keywords')
    year = request.form.get('year')
    volume = request.form.get('volume')            # NEW: Added
    page_number = request.form.get('page_number')  # NEW: Added
    pub_type = request.form.get('pub_type')        # NEW: Added
    file = request.files.get('file')

    # 2. VALIDATION (Ensure core fields exist)
    if not all([faculty_id, title, domain, year, pub_type, file]):
        return jsonify({"message": "Please enter all required details"}), 400

    # 3. DUPLICATE CHECK
    existing = users_collection.find_one({"papers.title": {"$regex": f"^{title}$", "$options": "i"}})
    if existing:
        return jsonify({"message": "The paper is already in the repository"}), 400

    # 4. FILE HANDLING
    file_id = str(uuid.uuid4())[:8] 
    original_name = secure_filename(file.filename)
    unique_name = f"{file_id}_{original_name}"
    temp_path = os.path.join(TEMP_FOLDER, "temp_" + unique_name)
    final_path = os.path.join(UPLOAD_FOLDER, unique_name)
    
    file.save(temp_path)
    
    try:
        compress_pdf(temp_path, final_path)
        if os.path.exists(temp_path):
            os.remove(temp_path) 
    except Exception as e:
        print(f"Compression error: {e}")
        os.rename(temp_path, final_path) 

    # 5. CONSTRUCT THE FULL PAPER OBJECT
    new_paper = {
        "file_id": file_id,
        "title": title,
        "journal_name": journal_name,   # SAVED TO DB
        "domain": domain,
        "keywords": keywords,
        "year": year,
        "volume": volume,               # SAVED TO DB
        "page_number": page_number,     # SAVED TO DB
        "pub_type": pub_type,           # SAVED TO DB (Crucial for Dashboard logic)
        "file_url": final_path,
        "created_at": datetime.utcnow()
    }
    
    # 6. UPDATE DATABASE
    users_collection.update_one(
        {"faculty_id": faculty_id},
        {"$push": {"papers": new_paper}}
    )

    return jsonify({"message": "The paper uploaded successfully"}), 200

# --- UNIVERSAL EMAIL FUNCTION ---
# This replaces send_welcome_email to handle all types of notifications
def send_email(receiver_email, subject, body):
    sender_email = GMAIL_USER 
    password = GMAIL_APP_PASSWORD

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = receiver_email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email Error: {e}")
        return False

# --- REGISTER ---
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    
    existing_user = users_collection.find_one({
        "$or": [
            {"faculty_id": data.get('faculty_id')}, 
            {"email": data.get('email')}
        ]
    })
    
    if existing_user: 
        return jsonify({"message": "The user already exists"}), 400
    
    hashed_password = generate_password_hash(data.get('password'))
    
    # Creates user with is_approved: False and status: "inactive"
    new_user = create_user_template(
        name=data.get('name'), 
        faculty_id=data.get('faculty_id'), 
        email=data.get('email'), 
        password=hashed_password, 
        department=data.get('department'),
        position=data.get('position', 'Faculty')
    )
    
    new_user['profile_pic'] = data.get('profile_pic', '') 
    users_collection.insert_one(new_user)
    
    return jsonify({"message": "Registration request sent to Admin for approval"}), 201

# --- LOGIN ---
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    # Clean the input: remove spaces and force lowercase for the ID
    faculty_id = str(data.get('faculty_id', '')).strip().lower()
    password = str(data.get('password', ''))

    # Pull fresh from environment
    target_admin = str(os.getenv("ADMIN_USERNAME", "")).strip().lower()
    target_pass = str(os.getenv("ADMIN_PASSWORD", ""))

    # 1. ADMIN CHECK (Matches .env)
    if target_admin and faculty_id == target_admin and password == target_pass:
        return jsonify({
            "user": {
                "role": "admin",
                "name": "Administrator",
                "faculty_id": target_admin, # Sending back the clean 'admin' ID
                "profile_pic": "../assets/images/logo.png"
            }
        }), 200

    # 2. FACULTY CHECK (Check MongoDB)
    user = users_collection.find_one({"faculty_id": faculty_id})
    
    if user and check_password_hash(user['password'], password):
        # Check if the Professor has approved them yet
        if not user.get('is_approved', False):
            return jsonify({"message": "Account pending approval. Please try again later."}), 403

        return jsonify({
            "user": {
                "role": "faculty",
                "name": user['name'], 
                "faculty_id": user['faculty_id'], 
                "profile_pic": user.get('profile_pic', ''),
                "status": user.get('status', 'active'),
                "position": user.get('position', 'Assistant Professor')
            }
        }), 200
    
    return jsonify({"message": "Invalid faculty ID or password"}), 401

# --- GET PENDING REQUESTS (For the Admin Notification Box) ---
@auth_bp.route('/pending-registrations', methods=['GET'])
def get_pending_registrations():
    # Only find users where is_approved is False
    pending_users = list(users_collection.find({"is_approved": False}, {"_id": 0, "password": 0}))
    return jsonify(pending_users), 200

# --- 1. HANDLE ACCOUNT REGISTRATION ---
@auth_bp.route('/handle-registration', methods=['POST'])
def handle_registration():
    verify_admin()
    data = request.json
    faculty_id = data.get('faculty_id')
    action = data.get('action') 

    user = users_collection.find_one({"faculty_id": faculty_id})
    if not user: 
        return jsonify({"message": "User not found"}), 404

    if action == 'approve':
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$set": {"is_approved": True, "status": "active"}}
        )
        # EMAIL: Welcome to SIT Repository
        subject = "Welcome to SIT Repository"
        body = f"Dear {user['name']},\n\nYour account request has been approved by the Admin. You can now login to the SIT Repository and manage your research papers.\n\nRegards,\nSIT REPOSITORY ADMIN"
        send_email(user['email'], subject, body)
        return jsonify({"message": "Account approved and Welcome email sent"}), 200
    
    else:
        users_collection.delete_one({"faculty_id": faculty_id})
        return jsonify({"message": "Account request declined and removed"}), 200
    
# --- DASHBOARD FEED (Updated for Sync & Sorting) ---
@auth_bp.route('/all-papers', methods=['GET'])
def get_all_papers():
    all_papers = []
    # Fetch only approved faculty members
    users = users_collection.find({"is_approved": True})
    
    for user in users:
        for paper in user.get('papers', []):
            # We must include 'created_at' here so the sort function can see it!
            all_papers.append({
                "title": paper.get('title'),
                "author_name": user.get('name'),
                "department": user.get('department'),
                "user_status": user.get('status', 'active'), # Syncs Admin status
                "profile_pic": user.get('profile_pic'),
                "domain": paper.get('domain'),
                "year": paper.get('year'),
                "pub_type": paper.get('pub_type', 'Publication'),
                "journal_name": paper.get('journal_name', 'N/A'),
                "volume": paper.get('volume', 'N/A'),
                "page_number": paper.get('page_number', 'N/A'),
                "keywords": paper.get('keywords', ''),
                "file_id": paper.get('file_id'),
                "created_at": paper.get('created_at') # CRITICAL: Added this line
            })

    # Sort the final list by created_at in descending order (Newest First)
    # We use a fallback (defaulting to a very old date) in case 'created_at' is missing
    all_papers.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
    
    return jsonify(all_papers)

# --- FORGOT PASSWORD ---
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"message": "Email not found"}), 404

    # 1. Generate random 6-digit password
    new_temp_pass = str(secrets.randbelow(900000) + 100000)
    
    # 2. Update Database with the new hashed password
    hashed_temp_pass = generate_password_hash(new_temp_pass)
    users_collection.update_one(
        {"email": email},
        {"$set": {"password": hashed_temp_pass}}
    )

    # 3. Send Email
    try:
        user_name = user.get('name', 'User')
        msg_body = f"Dear {user_name}, {new_temp_pass} please use this as your password for entering the SIT REPOSITORY."
        msg = MIMEText(msg_body)
        msg['Subject'] = 'SIT Repository - Password Reset'
        msg['From'] = GMAIL_USER
        msg['To'] = email

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)
            
        return jsonify({"message": "Temporary password sent successfully"}), 200
    except Exception as e:
        print(f"Mail Error: {e}")
        return jsonify({"message": "Failed to send email"}), 500

# --- USER DETAILS ---
@auth_bp.route('/user-details/<fid>', methods=['GET'])
def get_user_details(fid):
    user = users_collection.find_one({"faculty_id": fid}, {"password": 0})
    if user:
        user['_id'] = str(user['_id'])
        return jsonify(user), 200
    return jsonify({"message": "User not found"}), 404

# --- UPDATE PROFILE PIC ---
@auth_bp.route('/update-profile-pic', methods=['POST'])
def update_profile_pic():
    data = request.json
    users_collection.update_one(
        {"faculty_id": data.get('faculty_id')}, 
        {"$set": {"profile_pic": data.get('profile_pic')}}
    )
    return jsonify({"message": "Profile picture updated successfully"}), 200

# --- CHANGE PASSWORD ---
@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data = request.json
    faculty_id = data.get('faculty_id')
    current_pass = data.get('current_password')
    new_pass = data.get('new_password')
    confirm_pass = data.get('confirm_password')

    user = users_collection.find_one({"faculty_id": faculty_id})
    if not user:
        return jsonify({"message": "User not found"}), 404

    if not check_password_hash(user['password'], current_pass):
        return jsonify({"message": "the password was wrong"}), 400

    if new_pass != confirm_pass:
        return jsonify({"message": "the password is mismatch"}), 400

    hashed_new_password = generate_password_hash(new_pass)
    users_collection.update_one(
        {"faculty_id": faculty_id},
        {"$set": {"password": hashed_new_password}}
    )
    return jsonify({"message": "the password has been changed"}), 200

# --- DELETE PAPER (Updated to Request-Only for Step 2) ---
@auth_bp.route('/delete-paper', methods=['POST'])
def delete_paper():
    data = request.json
    faculty_id = data.get('faculty_id')
    file_id = data.get('file_id')
    
    # We do NOT remove the file or pull from DB here.
    # We only set the 'pending_deletion' flag to True.
    result = users_collection.update_one(
        {"faculty_id": faculty_id, "papers.file_id": file_id},
        {"$set": {"papers.$.pending_deletion": True}}
    )
    
    if result.modified_count > 0:
        return jsonify({
            "message": "Deletion request sent to Admin. The paper will be removed once approved."
        }), 200
    else:
        return jsonify({"message": "Paper not found or already pending deletion"}), 404
    

# --- DELETE PROFILE ---
@auth_bp.route('/delete-profile', methods=['POST'])
def delete_profile():
    verify_admin()  # Ensure only the admin can trigger this
    data = request.json
    faculty_id = data.get('faculty_id')

    if not faculty_id:
        return jsonify({"error": "Missing Faculty ID"}), 400

    try:
        # This deletes the user and their nested 'papers' array permanently
        result = users_collection.delete_one({"faculty_id": faculty_id})

        if result.deleted_count > 0:
            return jsonify({"message": f"Profile {faculty_id} deleted successfully"}), 200
        else:
            return jsonify({"error": "Profile not found"}), 404

    except Exception as e:
        print(f"Delete Profile Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- 1. GET ALL DATA FOR ADMIN DASHBOARD ---
@auth_bp.route('/admin-stats', methods=['GET'])
def get_admin_stats():
    verify_admin()
    try:
        users = list(users_collection.find())
        
        profiles = []
        dept_counts = {}
        paper_counts = {}  
        
        # Arrays for Notification Boxes
        account_requests = []
        position_requests = []
        deletion_requests = []
        department_requests = []

        for u in users:
            # --- FIX: Define 'user_papers' here so we can use it in both places ---
            user_papers = u.get('papers', [])
            p_count = len(user_papers)
            current_status = u.get('status', 'inactive') 
            dept = u.get('department', 'Unknown')

            # A. MAIN PROFILE TABLE DATA
            profiles.append({
                "name": u.get('name'),
                "faculty_id": u.get('faculty_id'),
                "department": dept,
                "paper_count": p_count,
                "status": current_status,
                "position": u.get('position', 'Assistant Professor')
            })

            # B. SCAN FOR NOTIFICATION BOXES
            if not u.get('is_approved', False):
                account_requests.append({
                    "name": u.get('name'),
                    "faculty_id": u.get('faculty_id'),
                    "department": dept,
                    "position": u.get('position')
                })
            
            if u.get('pending_position'):
                position_requests.append({
                    "name": u.get('name'),
                    "faculty_id": u.get('faculty_id'),
                    "department": dept,
                    "current_position": u.get('position'),
                    "new_position": u.get('pending_position')
                })
            
            if u.get('pending_department'):
                department_requests.append({
                    "name": u.get('name'),
                    "faculty_id": u.get('faculty_id'),
                    "position": u.get('position'),
                    "current_department": dept,
                    "new_department": u.get('pending_department')
                })
            
            for paper in user_papers:
                if paper.get('pending_deletion', False):
                    deletion_requests.append({
                        "name": u.get('name'),
                        "faculty_id": u.get('faculty_id'),
                        "department": dept,
                        "position": u.get('position'),
                        "paper_title": paper.get('title'),
                        "file_id": paper.get('file_id')
                    })

            # C. CALCULATE DEPARTMENT PROFILE STATS
            if dept not in dept_counts:
                dept_counts[dept] = {"total": 0, "active": 0, "inactive": 0}
            
            dept_counts[dept]["total"] += 1
            if current_status == 'active':
                dept_counts[dept]["active"] += 1
            else:
                dept_counts[dept]["inactive"] += 1

            # D. CALCULATE DEPT PAPER COUNT STATS
            if dept not in paper_counts:
                paper_counts[dept] = {"total": 0, "journals": 0, "conferences": 0}

            for paper in user_papers:
                paper_counts[dept]["total"] += 1
                p_type = str(paper.get('pub_type', '')).lower()
                if 'journal' in p_type:
                    paper_counts[dept]["journals"] += 1
                elif 'conference' in p_type:
                    paper_counts[dept]["conferences"] += 1

        # Format Profile Stats for JSON
        formatted_dept_stats = []
        for d, stats in dept_counts.items():
            formatted_dept_stats.append({"dept": d, **stats})

        # Format Paper Stats for JSON
        formatted_paper_stats = []
        for d, stats in paper_counts.items():
            formatted_paper_stats.append({"dept": d, **stats})

        # RETURN EVERYTHING TO THE FRONTEND
        return jsonify({
            "profiles": profiles,
            "deptStats": formatted_dept_stats,
            "paperStats": formatted_paper_stats,
            "requests": {
                "accounts": account_requests,
                "positions": position_requests,
                "deletions": deletion_requests,
                "departments": department_requests
            }
        }), 200

    except Exception as e:
        print(f"Admin Stats Error: {e}")
        return jsonify({"error": str(e)}), 500
    
# --- 2. TOGGLE USER STATUS (ACTIVE/INACTIVE) ---
@auth_bp.route('/update-status', methods=['POST'])
def update_status():
    verify_admin()
    data = request.json
    faculty_id = data.get('faculty_id')
    # We use 'status' here. We DO NOT touch 'is_approved'.
    new_state = data.get('status') # This will be 'active' or 'inactive'

    try:
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$set": {"status": new_state}} # Updates only the status field
        )
        return jsonify({
            "message": f"User status successfully changed to {new_state}",
            "current_status": new_state
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# --- POSITION CHANGE REQUEST SYSTEM ---

@auth_bp.route('/request-position-change', methods=['POST'])
def request_position_change():
    data = request.json
    faculty_id = data.get('faculty_id')
    new_pos = data.get('new_position')
    
    # Store the request in a temporary field 'pending_position'
    users_collection.update_one(
        {"faculty_id": faculty_id},
        {"$set": {"pending_position": new_pos}}
    )
    return jsonify({"message": "Position change request submitted to Admin"}), 200

# --- 2. HANDLE POSITION CHANGE REQUESTS (Updated Emails) ---
@auth_bp.route('/handle-position-decision', methods=['POST'])
def handle_position_decision():
    verify_admin()
    data = request.json
    faculty_id = data.get('faculty_id')
    action = data.get('action')

    user = users_collection.find_one({"faculty_id": faculty_id})
    if not user: 
        return jsonify({"message": "User not found"}), 404

    old_pos = user.get('position', 'N/A')
    new_pos = user.get('pending_position', 'N/A')

    if action == 'approve':
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$set": {"position": new_pos}, "$unset": {"pending_position": ""}}
        )
        # EMAIL: Position Approved (Success)
        subject = "Position Updated - SIT Repository"
        body = f"Dear {user['name']},\n\nas your request the position change from {old_pos} to {new_pos} has been approved.\n\nRegards,\nSIT REPOSITORY ADMIN"
        send_email(user['email'], subject, body)
        return jsonify({"message": "Position approved"}), 200
    
    else:
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$unset": {"pending_position": ""}}
        )
        # EMAIL: Position Declined
        subject = "Position Request Declined - SIT Repository"
        body = f"Dear {user['name']},\n\nas you request the position from {old_pos} to {new_pos} has been declined..for any queries please contact the SIT REPOSITORY ADMIN..\n\nRegards,\nSIT REPOSITORY ADMIN"
        send_email(user['email'], subject, body)
        return jsonify({"message": "Position change declined"}), 200

# --- 3. NEW: HANDLE PAPER DELETION REQUESTS ---
@auth_bp.route('/handle-paper-deletion', methods=['POST'])
def handle_paper_deletion():
    verify_admin()
    data = request.json
    faculty_id = data.get('faculty_id')
    file_id = data.get('file_id')
    action = data.get('action') 

    user = users_collection.find_one({"faculty_id": faculty_id})
    if not user: return jsonify({"message": "User not found"}), 404

    # Locate the paper title for the email notification
    paper_title = "Research Paper"
    for p in user.get('papers', []):
        if p['file_id'] == file_id:
            paper_title = p['title']
            break

    if action == 'approve':
        # Remove paper from the user's papers array
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$pull": {"papers": {"file_id": file_id}}}
        )
        # EMAIL: deletion-success
        subject = "Paper Deletion Successful"
        body = f"Dear {user['name']},\n\nas your request the paper ({paper_title}) has been deleted successfully."
        send_email(user['email'], subject, body)
        return jsonify({"message": "Paper deleted successfully"}), 200

    else:
        # Revoke the request: set pending_deletion to False so it stays visible
        users_collection.update_one(
            {"faculty_id": faculty_id, "papers.file_id": file_id},
            {"$set": {"papers.$.pending_deletion": False}}
        )
        # EMAIL: deletion-revoke
        subject = "Paper Deletion Request Declined"
        body = f"Dear {user['name']},\n\nas your request the paper ({paper_title}) has not been deleted...for any queries please contact the SIT REPOSITORY ADMIN..."
        send_email(user['email'], subject, body)
        return jsonify({"message": "Deletion request declined"}), 200
# --- 4. NEW: DEPARTMENT CHNAGE REQUESTS ---
@auth_bp.route('/request-department-change', methods=['POST'])
def request_department_change():
        data = request.json
        faculty_id = data.get('faculty_id')
        new_dept = data.get('new_department')    
        users_collection.update_one(
            {"faculty_id": faculty_id},
            {"$set": {"pending_department": new_dept}}
        )
        return jsonify({"message": "Department change request submitted"}), 200

# Decision Route (With Emails)
@auth_bp.route('/handle-department-decision', methods=['POST'])
def handle_department_decision():
        verify_admin()
        data = request.json
        faculty_id = data.get('faculty_id')
        action = data.get('action')
        user = users_collection.find_one({"faculty_id": faculty_id})
        if not user: return jsonify({"message": "User not found"}), 404

        old_dept = user.get('department', 'N/A')
        new_dept = user.get('pending_department', 'N/A')

        if action == 'approve':
            users_collection.update_one(
                {"faculty_id": faculty_id},
                {"$set": {"department": new_dept}, "$unset": {"pending_department": ""}}
            )
            # Success Email
            subject = "Department Updated - SIT Repository"
            body = f"Dear {user['name']},\n\nas your request your department has been changed form {old_dept} to {new_dept}.\n\nRegards,\nSIT REPOSITORY ADMIN"
            send_email(user['email'], subject, body)
            return jsonify({"message": "Department approved"}), 200
            
        else:
            users_collection.update_one(
                {"faculty_id": faculty_id},
                {"$unset": {"pending_department": ""}}
            )
            # Revoke Email
            subject = "Department Request Declined - SIT Repository"
            body = f"Dear {user['name']},\n\nas your request your department has not been changed form {old_dept} to {new_dept}..for any queries please contact the admin of SIT REPOSITORY..\n\nRegards,\nSIT REPOSITORY ADMIN"
            send_email(user['email'], subject, body)
            return jsonify({"message": "Department change declined"}), 200

# --- PUBLIC STATS FOR INDEX PAGE ---
@auth_bp.route('/public-stats', methods=['GET'])
def get_public_stats():
    try:
        # Only get users who are approved by admin
        users = list(users_collection.find({"is_approved": True}))
        
        positions = ["Principal", "Dean", "HOD", "Professor", "Associate Professor", "Assistant Professor"]
        staff_counts = {p: 0 for p in positions}
        pub_stats = {"journals": 0, "conferences": 0}
        dept_data = {} # { "CSE": {"journals": 0, "conferences": 0, "faculty": 0} }
        
        # Growth Data: Get current year and 4 years back
        current_year = datetime.utcnow().year
        year_range = [str(y) for y in range(current_year - 4, current_year + 1)]
        yearly_growth = {year: 0 for year in year_range}

        for u in users:
            dept = u.get('department', 'General')
            if dept not in dept_data:
                dept_data[dept] = {"journals": 0, "conferences": 0, "faculty": 0}

            # --- PART A: PAPER COUNTING (Always counts for all approved users) ---
            for p in u.get('papers', []):
                p_type = str(p.get('pub_type', '')).lower()
                p_year = str(p.get('year'))

                # Total Publication Totals & Dept Totals
                if 'journal' in p_type:
                    pub_stats["journals"] += 1
                    dept_data[dept]["journals"] += 1
                else:
                    pub_stats["conferences"] += 1
                    dept_data[dept]["conferences"] += 1
                
                # Yearly Growth Data
                if p_year in yearly_growth:
                    yearly_growth[p_year] += 1

            # --- PART B: FACULTY COUNTING (Only counts if user status is ACTIVE) ---
            if u.get('status') == 'active':
                # Map "Head of the Department" to "HOD" for the frontend display
                pos = u.get('position', 'Assistant Professor')
                if pos == "Head of the Department":
                    staff_counts["HOD"] += 1
                elif pos in staff_counts:
                    staff_counts[pos] += 1
                else:
                    staff_counts["Assistant Professor"] += 1

                # Increment Faculty count for the department table
                dept_data[dept]["faculty"] += 1

        # 4. Top 5 Publishers (Remains based on total papers ever published)
        top_5 = sorted(users, key=lambda x: len(x.get('papers', [])), reverse=True)[:5]
        formatted_top_5 = [{
            "name": t.get('name'),
            "dept": t.get('department'),
            "pos": t.get('position'),
            "count": len(t.get('papers', [])),
            "pic": t.get('profile_pic', '')
        } for t in top_5]

        return jsonify({
            "staff": staff_counts,
            "publications": pub_stats,
            "topPublishers": formatted_top_5,
            "deptStats": dept_data,
            "yearlyGrowth": yearly_growth 
        }), 200
    except Exception as e:
        print(f"Error in public-stats: {e}")
        return jsonify({"error": str(e)}), 500