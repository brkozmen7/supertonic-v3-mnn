#!/usr/bin/env python3
"""
Supertonic v3 MNN - Python API ile ses uretme ornegi.

Kullanim:
    python example_tts.py "Merhaba dunya, Turkce cok guzel bir dil." --voice F3 --precision int8

Bu script, CLI'yi (supertonic-mnn komutu) hic cagirmadan dogrudan Python
API'sini kullanir. Ayni klasorde calistirilmali (model_dir = bu klasor).
"""
import argparse
import os
import soundfile as sf

from supertonic_mnn.model import load_text_to_speech, get_voice_style_path
from supertonic_mnn.engine import load_voice_style

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text", help="Seslendirilecek metin")
    ap.add_argument("--lang", default="tr")
    ap.add_argument("--voice", default="F3", help="F1-F5 / M1-M5")
    ap.add_argument("--precision", default="int8", choices=["fp32", "fp16", "int8"])
    ap.add_argument("--steps", type=int, default=3, help="Denoising adim sayisi (2-5)")
    ap.add_argument("--speed", type=float, default=1.05)
    ap.add_argument("--output", default="output.wav")
    args = ap.parse_args()

    print(f"Model yukleniyor (precision={args.precision})...")
    tts = load_text_to_speech(model_dir=ROOT, precision=args.precision, version="v3")

    style_path = get_voice_style_path(args.voice, model_dir=ROOT, version="v3")
    style = load_voice_style([style_path])

    print(f"Sentezleniyor: '{args.text[:50]}...'")
    wav, dur, rtf = tts(
        text=args.text,
        lang=args.lang,
        style=style,
        total_step=args.steps,
        speed=args.speed,
    )

    # wav shape: (1, N) -> duz array'e cevir
    audio = wav.reshape(-1)
    sf.write(args.output, audio, tts.sample_rate)
    print(f"Kaydedildi: {args.output}")


if __name__ == "__main__":
    main()
