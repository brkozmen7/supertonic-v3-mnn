import sys
import os
import json
import re
import numpy as np
import base64
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import soundfile as sf
import io

# Add parent directory and src directory to python search path
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PARENT_DIR)
sys.path.append(os.path.join(PARENT_DIR, "src"))

from supertonic_mnn.model import load_text_to_speech, get_voice_style_path
from supertonic_mnn.engine import load_voice_style

app = FastAPI(title="Supertonic TTS API & UI")

# Model & Style Caches to prevent reloading unless parameters change
tts_models = {}
voice_styles = {}

def get_tts_model(precision: str = "int8"):
    """Fetch or load the MNN model with the specified precision."""
    if precision not in tts_models:
        print(f"[TTS Server] Loading MNN model with precision={precision}...")
        tts_models[precision] = load_text_to_speech(
            model_dir=PARENT_DIR,
            precision=precision,
            version="v3"
        )
    return tts_models[precision]

def get_voice_style_cached(voice: str):
    """Fetch or load the voice style JSON profile."""
    if voice not in voice_styles:
        print(f"[TTS Server] Loading voice style profile: {voice}...")
        style_path = get_voice_style_path(voice, model_dir=PARENT_DIR, version="v3")
        voice_styles[voice] = load_voice_style([style_path])
    return voice_styles[voice]

def split_text_to_sentences(text: str) -> list[str]:
    """
    Split text dynamically by paragraphs and sentences.
    Ensures that bullet points are processed nicely and short clauses are merged.
    """
    paragraphs = text.split("\n")
    chunks = []
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        # Match sentence endings (. ! ?) followed by whitespace or end of string.
        # Excludes common abbreviations like Mr., Mrs., Dr., etc.
        pattern = r"(?<!Mr\.)(?<!Mrs\.)(?<!Ms\.)(?<!Dr\.)(?<!Prof\.)(?<!etc\.)(?<!e\.g\.)(?<!i\.e\.)(?<=[.!?])\s+"
        sentences = re.split(pattern, para)
        
        current_chunk = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # If the current chunk is too short, merge it with the new sentence to maintain natural flow.
            if len(current_chunk) > 0 and len(current_chunk) < 15:
                current_chunk += " " + sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
                
        if current_chunk:
            chunks.append(current_chunk)
            
    return chunks

def trim_silence(wav: np.ndarray, sr: int, threshold_db: float = -40.0) -> np.ndarray:
    """Trims leading and trailing silence from the generated float32 audio array."""
    y = wav.reshape(-1)
    thresh = 10 ** (threshold_db / 20)
    
    active = np.where(np.abs(y) > thresh)[0]
    if len(active) == 0:
        return wav
        
    start_idx = active[0]
    end_idx = active[-1]
    
    # Keep a safety margin of 0.01 seconds (approx. 441 samples at 44100Hz)
    margin = int(0.01 * sr)
    start_idx = max(0, start_idx - margin)
    end_idx = min(len(y), end_idx + margin)
    
    trimmed_y = y[start_idx:end_idx]
    return trimmed_y.reshape(wav.shape[0], -1)


@app.websocket("/ws/tts")
async def websocket_endpoint(websocket: WebSocket):
    """
    Bi-directional WebSocket handler.
    Allows clients to send generation requests and receive raw audio chunks.
    Supports real-time interruption via 'stop' signals.
    """
    await websocket.accept()
    print("[WebSocket] Client connected.")
    
    task_queue = asyncio.Queue()
    stop_flag = [False]  # Mutable cell
    session_counter = [0]
    
    async def client_reader():
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                if msg_type == "generate":
                    print("[WebSocket] Received new generate request.")
                    # Increment session id
                    session_counter[0] += 1
                    data["session_id"] = session_counter[0]
                    # Terminate current generation
                    stop_flag[0] = True
                    # Drain queue
                    while not task_queue.empty():
                        try:
                            task_queue.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                    await task_queue.put(data)
                elif msg_type == "stop":
                    print("[WebSocket] Received stop command.")
                    stop_flag[0] = True
                    # Increment session id to abort any currently executing loops
                    session_counter[0] += 1
                    await websocket.send_json({"type": "status_update", "status": "stopped"})
        except WebSocketDisconnect:
            print("[WebSocket] Client connection closed in reader.")
        except Exception as e:
            print(f"[WebSocket] Reader exception: {e}")

    reader_task = asyncio.create_task(client_reader())
    
    try:
        while True:
            # Wait for next generation task
            data = await task_queue.get()
            
            active_session_id = data.get("session_id", 0)
            # Reset stop flag for this new session
            stop_flag[0] = False
            
            text = data.get("text", "")
            voice = data.get("voice", "F1")
            lang = data.get("lang", "tr")
            precision = data.get("precision", "int8")
            steps = int(data.get("steps", 6))
            speed = float(data.get("speed", 1.05))
            
            chunks = split_text_to_sentences(text)
            if not chunks:
                await websocket.send_json({"type": "error", "message": "Text could not be segmented."})
                continue
                
            # If a newer session took over while segmenting, abort
            if session_counter[0] != active_session_id:
                continue
                
            await websocket.send_json({
                "type": "metadata",
                "chunks": chunks
            })
            
            try:
                tts = get_tts_model(precision)
                style = get_voice_style_cached(voice)
            except Exception as e:
                await websocket.send_json({"type": "error", "message": f"Model loading failed: {str(e)}"})
                continue
                
            loop = asyncio.get_running_loop()
            
            for i, chunk in enumerate(chunks):
                if stop_flag[0] or session_counter[0] != active_session_id:
                    print(f"[WebSocket] Execution cancelled. Stop flag: {stop_flag[0]}, Session mismatch: {session_counter[0]} != {active_session_id}")
                    break
                    
                await websocket.send_json({
                    "type": "status",
                    "chunk_index": i,
                    "status": "generating"
                })
                
                try:
                    # Run inference in executor thread to prevent blocking Uvicorn's event loop
                    wav, dur, elapsed = await loop.run_in_executor(
                        None,
                        lambda: tts._infer([chunk], [lang], style, steps, speed)
                    )
                    
                    # Trim silence from the audio chunk
                    wav = trim_silence(wav, tts.sample_rate)
                    
                    # Convert float32 wav array to 16-bit PCM bytes
                    audio_data = wav.reshape(-1)
                    audio_data = np.clip(audio_data, -1.0, 1.0)
                    audio_int16 = (audio_data * 32767).astype(np.int16)
                    
                    pcm_base64 = base64.b64encode(audio_int16.tobytes()).decode("utf-8")
                    
                    if stop_flag[0] or session_counter[0] != active_session_id:
                        break
                        
                    duration_val = len(audio_data) / tts.sample_rate
                    generation_time_val = float(elapsed)
                    rtf_val = generation_time_val / duration_val if duration_val > 0 else 0
                    
                    await websocket.send_json({
                        "type": "audio",
                        "chunk_index": i,
                        "audio": pcm_base64,
                        "sample_rate": tts.sample_rate,
                        "duration": duration_val,
                        "generation_time": generation_time_val,
                        "rtf": rtf_val
                    })
                    
                    await websocket.send_json({
                        "type": "status",
                        "chunk_index": i,
                        "status": "completed",
                        "duration": duration_val,
                        "generation_time": generation_time_val,
                        "rtf": rtf_val
                    })
                except Exception as e:
                    print(f"[WebSocket] Error during chunk {i} generation: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Chunk {i} synthesis failed: {str(e)}"
                    })
            
            if not stop_flag[0] and session_counter[0] == active_session_id:
                await websocket.send_json({"type": "done"})
                
    except WebSocketDisconnect:
        print("[WebSocket] Connection closed.")
    finally:
        reader_task.cancel()


class SynthesizeRequest(BaseModel):
    text: str
    voice: str = "F5"
    lang: str = "tr"
    precision: str = "int8"
    steps: int = 5
    speed: float = 1.05
    silence_duration: float = 0.15

@app.post("/api/synthesize")
async def api_synthesize(req: SynthesizeRequest):
    """
    Standard REST POST endpoint.
    Processes the request in-memory and returns a unified WAV audio download.
    Perfect for integration with jarvis_v2.py or other scripting environments.
    """
    try:
        tts = get_tts_model(req.precision)
        style = get_voice_style_cached(req.voice)
        
        chunks = split_text_to_sentences(req.text)
        if not chunks:
            raise HTTPException(status_code=400, detail="Synthesizable text cannot be empty.")
            
        wav_chunks = []
        sample_rate = tts.sample_rate
        loop = asyncio.get_running_loop()
        
        for i, chunk in enumerate(chunks):
            wav, dur, elapsed = await loop.run_in_executor(
                None,
                lambda: tts._infer([chunk], [req.lang], style, req.steps, req.speed)
            )
            wav = trim_silence(wav, sample_rate)
            wav_chunks.append(wav.reshape(-1))
            
            if i < len(chunks) - 1 and req.silence_duration > 0:
                silence = np.zeros(int(req.silence_duration * sample_rate), dtype=np.float32)
                wav_chunks.append(silence)
                
        full_wav = np.concatenate(wav_chunks)
        
        out_buf = io.BytesIO()
        sf.write(out_buf, full_wav, sample_rate, format='WAV')
        out_buf.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            out_buf,
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=synthesized.wav"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve static web interface
@app.get("/")
async def read_index():
    index_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    return FileResponse(index_path)

# Mount static folder
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Mount logo/favicon folder
app.mount("/logo", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "logo")), name="logo")
