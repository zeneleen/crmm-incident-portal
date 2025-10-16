from flask import Flask, request, jsonify, send_from_directory
import csv, os

app = Flask(__name__)

@app.route("/CaseID.csv")
def serve_csv():
    return send_from_directory(".", "CaseID.csv")

@app.route("/update_csv", methods=["POST"])
def update_csv():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data received"}), 400

        fieldnames = list(data[0].keys())
        with open("CaseID.csv", "w", newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
