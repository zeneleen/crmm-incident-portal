from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import csv
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # ✅ enables all origins (GitHub Pages included)

# --- Serve CSV file ---
@app.route("/CaseID.csv", methods=["GET", "OPTIONS"])
def serve_csv():
    try:
        csv_path = os.path.join(os.getcwd(), "CaseID.csv")

        # If not found, create one automatically
        if not os.path.exists(csv_path):
            with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=[
                    "case_id", "user_id", "organisation",
                    "below18", "violence", "armedGroup",
                    "incidentRemarks", "verifyStatus", "verifyRemarks"
                ])
                writer.writeheader()

        response = make_response(send_from_directory(os.getcwd(), "CaseID.csv"))
        # ✅ Add CORS headers manually to file responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        print("❌ Error serving CSV:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# --- Update CSV file ---
@app.route("/update_csv", methods=["POST", "OPTIONS"])
def update_csv():
    if request.method == "OPTIONS":
        # ✅ Handle preflight CORS requests
        response = make_response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"}), 400

        fieldnames = list(data[0].keys())
        with open("CaseID.csv", "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        response = jsonify({"status": "success"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    except Exception as e:
        print("❌ Error updating CSV:", e)
        response = jsonify({"status": "error", "message": str(e)})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response, 500


# --- Health check route ---
@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "running", "message": "CRMM Incident Portal backend active"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
