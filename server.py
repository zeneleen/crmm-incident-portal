from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv
import os

app = Flask(__name__)
CORS(app)  # allow GitHub Pages frontend to access this backend

# === Serve the CaseID.csv file ===
@app.route("/CaseID.csv", methods=["GET"])
def serve_csv():
    try:
        # Get the full path
        csv_path = os.path.join(os.getcwd(), "CaseID.csv")

        # Debug log (will show in Render logs)
        print("📁 Current directory:", os.getcwd())
        print("📄 Files here:", os.listdir(os.getcwd()))

        # If file doesn't exist, create a blank one with headers
        if not os.path.exists(csv_path):
            print("⚠️ CaseID.csv not found — creating new file.")
            with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=[
                    "case_id",
                    "user_id",
                    "organisation",
                    "Survivor(s) under 18?",
                    "At least one of the eight serious child rights violations?",
                    "Armed group involved?",
                    "Incident remarks",
                    "Verification status",
                    "Verification remarks"
                ])
                writer.writeheader()

        return send_from_directory(os.getcwd(), "CaseID.csv", as_attachment=False)

    except Exception as e:
        print("❌ Error serving CSV:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


# === Update the CaseID.csv file ===
@app.route("/update_csv", methods=["POST"])
def update_csv():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"status": "error", "message": "No data received"}), 400

        fieldnames = list(data[0].keys())

        # Write the updated CSV
        with open("CaseID.csv", "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        print("✅ CSV successfully updated with", len(data), "rows.")
        return jsonify({"status": "success"})

    except Exception as e:
        print("❌ Error updating CSV:", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


# === Health check route (optional) ===
@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "running", "message": "CRMM Incident Portal backend active"})


if __name__ == "__main__":
