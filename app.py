from flask import Flask, render_template, Response, jsonify, request, url_for
import os, cv2, time, json
from datetime import datetime
import uuid
from detector import HelmetDetector

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAP_DIR = os.path.join(BASE_DIR, 'static', 'captures')
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
ALERTS_DB = os.path.join(CAP_DIR, 'alerts.json')
os.makedirs(CAP_DIR, exist_ok=True)

default_config = {
        "area_name": "Câmera 1",
    "auto_capture": True,
    "min_seconds_between_alerts": 5,
    "detection_conf": 0.5
}
if os.path.exists(CONFIG_PATH):
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except:
        config = default_config
else:
    config = default_config
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=2)

def load_alerts():
    if os.path.exists(ALERTS_DB):
        try:
            with open(ALERTS_DB,'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_alert(alert):
    alerts = load_alerts()
    alerts.insert(0, alert)
    alerts = alerts[:1000]
    with open(ALERTS_DB,'w') as f:
        json.dump(alerts, f, indent=2)

try:
    detector = HelmetDetector()
except Exception as e:
    print('Aviso: detector não inicializado:', e)
    detector = None
last_saved_time = 0

@app.route('/')
def index():
    return render_template('index.html')

def gen_frames():
    global last_saved_time, detector, config
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW) if os.name=='nt' else cv2.VideoCapture(0)
    if not cap.isOpened():
        print('AVISO: não foi possível abrir a câmera (index 0).')
        return
    while True:
        success, frame = cap.read()
        if not success:
            break
        try:
            if detector and config.get('auto_capture', True):
                res = detector.detect(frame)
                if res == 'sem capacete':
                    now = time.time()
                    if now - last_saved_time > config.get('min_seconds_between_alerts', 5):
                        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                        filename = f"{config.get('area_name','LABORATORIO')}_{ts}_auto.jpg"
                        path = os.path.join(CAP_DIR, filename)
                        cv2.imwrite(path, frame)
                        alert = {
                            'filename': filename,
                            'path': f"captures/{filename}",
                            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            'area': config.get('area_name','LABORATORIO'),
                            'type': 'auto'
                        }
                        save_alert(alert)
                        last_saved_time = now
        except Exception as e:
            print('Erro na detecção:', e)
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    cap.release()

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/alerts')
def alerts_page():
    return render_template('alerts.html')

@app.route('/alerts_data')
def alerts_data():
    alerts = load_alerts()
    return jsonify({'alerts': alerts})

@app.route('/manual_capture', methods=['POST'])
def manual_capture():
    rand = uuid.uuid4().hex[:6]
    filename = datetime.now().strftime('%Y%m%d_%H%M%S_manual_') + rand + '.jpg'
    path = os.path.join(CAP_DIR, filename)
    try:
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW) if os.name=='nt' else cv2.VideoCapture(0)
        if cap.isOpened():
            success, frame = cap.read()
            if success:
                cv2.imwrite(path, frame)
            cap.release()
        else:
            with open(path,'wb') as f:
                f.write(b'')
        alert = {
            'filename': filename,
            'path': f"captures/{filename}",
            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'area': config.get('area_name','LABORATORIO'),
            'type': 'manual'
        }
        save_alert(alert)
        return jsonify({'saved_path': path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/clear_alerts', methods=['POST'])
def clear_alerts():
    try:
        if os.path.exists(ALERTS_DB):
            os.remove(ALERTS_DB)
        for fn in os.listdir(CAP_DIR):
            if fn.lower().endswith(('.jpg','.jpeg','.png')):
                os.remove(os.path.join(CAP_DIR, fn))
        return jsonify({'status':'ok'})
    except Exception as e:
        return jsonify({'status':'error','error':str(e)}),500


@app.route('/settings', methods=['GET','POST'])
def settings():
    global config
    if request.method == 'POST':
        data = request.json
        config.update(data)
        with open(CONFIG_PATH,'w') as f:
            json.dump(config, f, indent=2)
        return jsonify({'status':'ok','config':config})
    return render_template('settings.html', config=config)


@app.route('/config')
def config_endpoint():
    try:
        with open(CONFIG_PATH,'r') as f:
            cfg = json.load(f)
    except:
        cfg = default_config
    return jsonify(cfg)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)