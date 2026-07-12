# Lyra TTS Arayüzü & API Servisi

Bu klasör, Türkçe ve çok dilli ses sentezleme (multilingual TTS) yapabilen, **MNN (Alibaba Mobile Neural Network)** motoruyla çalışan stüdyo kalitesinde bir web arayüzü ve API servisidir.

---

## 🚀 Öne Çıkan Özellikler

- **Çok Dilli Arayüz (i18n):** Türkçe, İngilizce, Almanca, Fransızca, Korece ve Japonca dillerine dinamik olarak adapte olan stüdyo arayüzü.
- **10 Farklı Ses Karakteri:** 5 Kadın (Buse, Elif, Derin, Gamze, Elif v.b.) ve 5 Erkek (Bora, Hakan, Deniz v.b.) ses profili.
- **Çift Protokol Desteği:**
  - **HTTP REST API:** Hızlı entegrasyonlar ve tek seferde tam WAV çıktısı almak için.
  - **WebSocket API:** Canlı sentezleme akışı (real-time stream) ve çalma işlemleri için.
- **Gelişmiş Algoritmalar:** Akıllı cümle bölücü, dinamik başlangıç/bitiş sessizlik kırpma ve gerçek zamanlı ses dalga görselleştiricisi (waveform).

---

## 🛠️ Çalıştırma

Arayüzü ve arka plan API sunucusunu başlatmak için ana dizinde şu komutu vermeniz yeterlidir:
```bash
bash tts_interface/start.sh
```
Sunucu ayağa kalktığında **`http://localhost:8000`** adresinden stüdyo panelini açabilirsiniz.

---

## 🔌 API Kullanım Rehberi

### 1. HTTP REST API (Tek Seferde Ses Alma)
Tek bir POST isteğiyle birleştirilmiş WAV dosyası almak için kullanılır.

#### A) cURL Komutu
Terminalden doğrudan çalıştırmak ve sonucu Masaüstüne kaydetmek için:
```bash
curl -X POST "http://127.0.0.1:8000/api/synthesize" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Merhaba, bu HTTP REST API üzerinden tek seferde sentezlenen test sesidir.",
       "voice": "F5",
       "lang": "tr",
       "precision": "int8",
       "steps": 5,
       "speed": 1.05,
       "silence_duration": 0.15
     }' \
     --output ~/Masaüstü/lyra_http_out.wav
```

#### B) Python Kodu
```python
import os
import requests

url = "http://127.0.0.1:8000/api/synthesize"
payload = {
    "text": "Merhaba, bu HTTP REST API üzerinden tek seferde sentezlenen test sesidir.",
    "voice": "F5",            # F1-F5 / M1-M5
    "lang": "tr",             # tr, en, de, fr, ko, ja
    "precision": "int8",      # int8, fp32
    "steps": 5,
    "speed": 1.05,
    "silence_duration": 0.15
}

response = requests.post(url, json=payload)
if response.status_code == 200:
    desktop = os.path.expanduser("~/Masaüstü")
    if not os.path.exists(desktop):
        desktop = os.path.expanduser("~/Desktop")
        
    output_path = os.path.join(desktop, "lyra_http_out.wav")
    with open(output_path, "wb") as f:
        f.write(response.content)
    print(f"Başarılı! Kaydedilen konum: {output_path}")
```

---

### 2. WebSocket API (Gerçek Zamanlı Akış & Canlı Çalma)
Sentezlenen cümleler oluştukça **gerçek zamanlı dinlemek** ve en sonunda birleştirip kaydetmek için kullanılır.

#### CLI İstemcisi ile Kullanım
Ana dizinde bulunan `ws_cli_client.py` scripti ile WebSocket üzerinden akış alıp anlık olarak çalabilirsiniz.

```bash
.venv/bin/python3 ws_cli_client.py "Merhaba, bu websocket üzerinden parça parça alınıp. ardından adım adım oluşturup. sonrasına da masaüstüne kaydedilen test sesidir." \
  --voice F5 \
  --lang tr \
  --steps 5 \
  --speed 1.05
```

- **Canlı Çalma (Real-time Playback):** Ses kartına bağlı hoparlörden, sentezlenen her parça geldikçe arka arkaya çalınır.
- **Kaydetme:** Akış tamamen sonlandığında tüm sesler birleştirilerek **Masaüstünüze** `lyra_ws_out.wav` adıyla otomatik olarak yazılır.
