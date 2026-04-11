from pymongo import MongoClient
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Connect to the Database
client = MongoClient(os.getenv("MONGO_URI"))
db = client['sit_repo']
users_collection = db['users']

def create_user_template(name, faculty_id, email, password, department, position):
    """Creates the initial user document with required professor changes."""
    return {
        "name": name,
        "faculty_id": faculty_id,
        "email": email,
        "password": password,  
        "department": department,
        "position": position,           
        "status": "inactive",           # Default: Red/Inactive
        "is_approved": False,           # Waiting for Admin action
        "profile_pic": "",
        "papers": [] 
        # Paper object structure for reference:
        # {
        #   "file_id": "uuid",
        #   "title": "Title of Paper",
        #   "journal_name": "Name of Journal",
        #   "domain": "AI/ML",
        #   "keywords": "keyword1, keyword2",
        #   "year": "2024",
        #   "volume": "12",
        #   "page_number": "101-110",
        #   "pub_type": "Journal",      # "Journal" or "Conference"
        #   "file_url": "uploads/filename.pdf",
        #   "created_at": datetime.now()
        # }
    }