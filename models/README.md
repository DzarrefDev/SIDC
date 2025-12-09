# Modelos e treinamento

Este diretório deve conter seu(s) modelo(s) treinados para detectar `person` e `helmet` (ou classes equivalentes). Há duas abordagens comuns:

## 1) Treinar YOLOv5 / YOLOv8

- Prepare dataset no formato COCO ou YOLO (labels por imagem com bounding boxes e classes `person` / `helmet`).
- Treine com Ultralytics YOLOv5/YOLOv8.

Exemplos rápidos (assumindo Ultralytics/yolov8 instalado):

```bash
# treine
yolo task=detect mode=train data=seu_dataset.yaml model=yolov8n.pt epochs=50
# depois pegue weights: runs/detect/train/weights/best.pt
# coloque best.pt em models/ como 'best.pt'
```

## 2) Usar transfer learning em detectores como Faster-RCNN, SSD, etc.

Qualquer que seja o formato, no `detector.py` você deve adaptar `load_production_model` e `_process_production` para carregar o modelo e retornar:

```json
{
  "no_helmet_detected": true/false,
  "details": { ... }
}
```

Recomendação: o modelo deve retornar boxes/class confidences; depois aplique regra: se existir `person` sem `helmet` cuja intersecção não mostrou `helmet` dentro do bbox da cabeça -> marque como `no_helmet_detected`.
