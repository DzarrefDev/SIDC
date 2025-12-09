# Extra routes to integrate UI without overwriting your original app.
from flask import current_app as app, render_template, jsonify, url_for
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAP_DIR = os.path.join(BASE_DIR, 'captures')

@app.route('/alerts')
def alerts():
    caps = []
    if os.path.exists(CAP_DIR):
        for fn in sorted(os.listdir(CAP_DIR), reverse=True):
            if fn.lower().endswith(('.jpg','.jpeg','.png')):
                path = os.path.join(CAP_DIR, fn)
                ts = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M:%S')
                camera = 'Desconhecida'
                if '_' in fn:
                    camera = fn.split('_')[0]
                caps.append({
                    'filename': fn,
                    'relative_path': f'captures/{fn}',
                    'time': ts,
                    'camera': camera
                })
    return render_template('alerts.html', captures=caps)

@app.route('/manual_capture', methods=['POST'])
def manual_capture():
    try:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'manual_{ts}.jpg'
        path = os.path.join(CAP_DIR, filename)
        # If your capture pipeline can provide an image, integrate here.
        # For now we create an empty placeholder file to signal a capture.
        os.makedirs(CAP_DIR, exist_ok=True)
        with open(path, 'wb') as f:
            f.write(b'')
        return jsonify({'saved_path': filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
