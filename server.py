from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv, os

app = Flask(__name__)
CORS(app)  # allows your GitHub Pages frontend to connect

# --- Serve CSV file ---
@app.route("/CaseID.csv")
def serve_csv():
    # ensure absolute path for safety
    file_path = os.path.join(os.getcwd(), "CaseID.csv")
    if os.path.exists(file_path):
        return send_from_directory(os.getcwd(), "CaseID.csv")
    else:
        return jsonify({"status": "error", "message": "CSV file not found"}), 404


# --- Update CSV file ---
@app.route("/update_csv", methods=["POST"])
def update_csv():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"}), 400

        fieldnames = list(data[0].keys())

        with open("CaseID.csv", "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
