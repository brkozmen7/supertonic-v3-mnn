# Supertonic v3 - MNN (Turkish-verified, self-converted)

Bu klasor, [Supertone/supertonic-3](https://huggingface.co/Supertone/supertonic-3) resmi ONNX
modelinin [Alibaba MNN](https://github.com/alibaba/MNN) motoruna kendi cevirdigimiz halidir.
Amac: Raspberry Pi gibi dusuk guclu cihazlarda ONNX Runtime'a gore cok daha hizli inference.

## Neden kendi cevirimiz var?

Resmi MNN portu ([yunfengwang/supertonic-tts-mnn](https://huggingface.co/yunfengwang/supertonic-tts-mnn),
HuggingFace'te host edilen model agirliklari) v3'te Turkce icin `unicode_indexer.json`
mapping hatasi tasiyor; Turkce karakterler (ç, ş, ğ, ö, ü, ı, İ) `<unk>` token'ina dusuyor,
cikti anlamsiz ses oluyor. Bu klasordeki modeller orijinal ONNX'ten dogrudan cevrilmis ve
resmi `unicode_indexer.json` ile Turkce'de dogrulanmis sekilde calisiyor.

CLI kodu [vra/supertonic-mnn](https://github.com/vra/supertonic-mnn) (GitHub) reposundan
alinmistir; sadece model agirliklari degistirilmis, kod ayni.

## Klasor yapisi

```
supertonic_v3_mnn/
├── config.json              <- MNN runtime ayarlari (thread, precision, backend)
├── example_tts.py            <- Python API ile calisma ornegi
├── v3/
│   ├── mnn_models/
│   │   ├── fp32/              <- ilk cevirdigimiz, tam hassasiyet (RTF ~0.17)
│   │   ├── int8/               <- weightQuantBits 8 ile kucultulmus, RPi icin (RTF ~0.18-0.22)
│   │   ├── tts.json
│   │   └── unicode_indexer.json
│   └── voice_styles/           <- F1-F5, M1-M5
├── src/supertonic_mnn/         <- CLI + Python API kaynak kodu
├── .venv/                      <- bagimsiz python 3.10 ortami
└── pyproject.toml / uv.lock
```

## Kurulum (sifirdan, baska makinede)

```bash
cd supertonic_v3_mnn
uv sync
```

MNN'in derlenmis `.so` dosyasi bazi Ubuntu 24.04 kurulumlarinda
`cannot enable executable stack` hatasi verebilir. Cikarsa:
```bash
python3 -c "
import struct, sys
PT_GNU_STACK, PF_X = 0x6474e551, 0x1
path = '.venv/lib/python3.10/site-packages/_mnncengine.cpython-310-x86_64-linux-gnu.so'
with open(path, 'r+b') as f:
    data = f.read()
    e_phoff = struct.unpack_from('<Q', data, 0x20)[0]
    e_phentsize = struct.unpack_from('<H', data, 0x36)[0]
    e_phnum = struct.unpack_from('<H', data, 0x38)[0]
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type, p_flags = struct.unpack_from('<II', data, off)
        if p_type == PT_GNU_STACK and p_flags & PF_X:
            f.seek(off + 4)
            f.write(struct.pack('<I', p_flags & ~PF_X))
            print('Duzeltildi')
"
```

## Ses uretme

### CLI ile
```bash
echo "Merhaba dunya" | .venv/bin/supertonic-mnn \
  --lang tr --version v3 --voice F3 --precision int8 --steps 3 \
  --model-dir . --output /tmp/test.wav
aplay /tmp/test.wav
```

### Python API ile
```bash
.venv/bin/python3 example_tts.py "Merhaba dunya, Turkce cok guzel bir dil." \
  --voice F3 --precision int8 --steps 3 --output /tmp/test.wav
```

Parametreler:
- `--voice` : F1-F5 (kadin), M1-M5 (erkek)
- `--precision` : `fp32` veya `int8` (RPi'de int8 tercih edilecek - kucuk dosya)
- `--steps` : 2-5 arasi, dusuk = hizli ama kalite dusebilir
- `--model-dir .` : bu klasorun kendisi (HF'den indirme YOK, tamamen lokal)

## Benchmark (ASUS laptop, CPU)

| Precision | Steps | RTF        |
|-----------|-------|------------|
| fp32      | 3     | ~0.17      |
| int8      | 3     | ~0.18-0.22 |

Thread sayisinin (2-20 arasi test edildi) RTF'ye pratikte etkisi yok - darbogaz
coklu thread'e iyi bolunmuyor, tek cekirdek performansi belirleyici. RPi4'te
`mnn_cfg_thread_num: 3` onerilir (4 cekirdegin 1'ini sisteme birakmak icin).

## Lisans

Model agirliklari degistirilmemistir, sadece format donusumu yapilmistir.
Orijinal model [OpenRAIL-M lisansi](https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE)
ile lisanslidir.
