import os
import mimetypes
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from google import genai
from google.genai import types
from werkzeug.utils import secure_filename
import uuid
import traceback

# Initialize Flask app
app = Flask(__name__, static_folder='static')
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "static/edited_images"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Gemini API Key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyCi3mSvbireG473HTlNO2klOPw1iD167V0")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def save_binary_file(file_name, data):
    with open(file_name, "wb") as f:
        f.write(data)
    return file_name

@app.route("/", methods=["GET"])
def serve_index():
    return send_file("index.html")

@app.route("/style.css", methods=["GET"])
def serve_css():
    return send_file("style.css")

@app.route("/script.js", methods=["GET"])
def serve_js():
    return send_file("script.js")

@app.route("/remove_object", methods=["POST"])
def remove_object():
    try:
        if "image" not in request.files or "description" not in request.form:
            return jsonify({"error": "Missing image or description"}), 400

        file = request.files["image"]
        description = request.form["description"].strip()

        if not description:
            return jsonify({"error": "Description cannot be empty"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Allowed types: png, jpg, jpeg"}), 400

        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        if file_size > 5 * 1024 * 1024:
            return jsonify({"error": "File size exceeds 5MB limit"}), 400
        file.seek(0)

        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        file.save(file_path)

        client = genai.Client(api_key=GEMINI_API_KEY)

        with open(file_path, "rb") as f:
            image_data = f.read()
        mime_type, _ = mimetypes.guess_type(file_path)

        prompt = f"Remove the {description} from the image and create a matching background to fill the space seamlessly. IMPORTANT: Maintain the exact same resolution and dimensions as the original image."
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part(
                        inline_data=types.Blob(
                            data=image_data,
                            mime_type=mime_type
                        )
                    ),
                ],
            ),
        ]

        print(f"Processing image: {file_path}")

        generate_content_config = types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            response_mime_type="text/plain"
        )

        edited_image_path = None
        for chunk in client.models.generate_content_stream(
            model="gemini-2.0-flash-preview-image-generation",
            contents=contents,
            config=generate_content_config,
        ):
            # Debug print chunk info
            print(f"Gemini API chunk: {chunk}")

            if (
                chunk.candidates is None
                or chunk.candidates[0].content is None
                or chunk.candidates[0].content.parts is None
            ):
                continue

            part = chunk.candidates[0].content.parts[0]
            if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                print(f"Received image data with MIME type: {part.inline_data.mime_type}")
                output_filename = f"edited_image_{uuid.uuid4()}{mimetypes.guess_extension(part.inline_data.mime_type)}"
                edited_image_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)
                save_binary_file(edited_image_path, part.inline_data.data)
            elif hasattr(chunk, "text"):
                print(f"Text response: {chunk.text}")

        print(f"edited_image_path: {edited_image_path}")

        if not edited_image_path:
            return jsonify({"error": "No edited image returned by Gemini API"}), 500

        edited_image_url = f"/static/edited_images/{os.path.basename(edited_image_path)}"
        print(f"Returning edited_image_url: {edited_image_url}")
        return jsonify({"edited_image_url": edited_image_url}), 200

    except Exception as e:
        print(f"Error in remove_object: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route("/static/edited_images/<filename>")
def serve_image(filename):
    return send_from_directory(app.config["OUTPUT_FOLDER"], filename)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
