from flask import Flask, render_template
from flask_cors import CORS
from routes.auth import auth_bp

# Tell Flask where your frontend folder is
app = Flask(__name__, 
            template_folder='frontend/pages', 
            static_folder='frontend/assets')

CORS(app)
app.register_blueprint(auth_bp, url_prefix='/auth')

@app.route('/')
def home():
    # Flask will now serve the HTML through http://127.0.0.1:5000
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)