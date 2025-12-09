import os
from ultralytics import YOLO

class HelmetDetector:
    def __init__(self, model_path=None):
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        if model_path is None:
            model_path = os.path.join(BASE_DIR, 'models', 'best.pt')
        else:
            if not os.path.isabs(model_path):
                model_path = os.path.join(BASE_DIR, model_path)

        print('Carregando modelo em:', model_path)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f'Arquivo de modelo não encontrado: {model_path}')

        self.model = YOLO(model_path)
        self.CAPACETE = 0
        self.SEM_CAPACETE = 1
        print('Detector carregado: 0=capacete, 1=sem capacete')

    def detect(self, frame):
        results = self.model.predict(frame, imgsz=640, conf=0.5)
        for result in results:
            for box in result.boxes:
                cls = int(box.cls[0])
                if cls == self.SEM_CAPACETE:
                    return 'sem capacete'
                if cls == self.CAPACETE:
                    return 'com capacete'
        return 'nenhuma pessoa detectada'
