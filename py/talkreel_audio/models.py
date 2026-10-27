"""Model files: Kokoro downloads, pinned by SHA-256, into a user cache directory.

faster-whisper models live in the Hugging Face cache and are fetched by faster-whisper itself.
"""

from __future__ import annotations

import hashlib
import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

KOKORO_RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"


@dataclass(frozen=True)
class ModelFile:
    name: str
    url: str
    sha256: str
    size: int


KOKORO_FILES = (
    ModelFile(
        "kokoro-v1.0.onnx",
        f"{KOKORO_RELEASE}/kokoro-v1.0.onnx",
        "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
        325532387,
    ),
    ModelFile(
        "voices-v1.0.bin",
        f"{KOKORO_RELEASE}/voices-v1.0.bin",
        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
        28214398,
    ),
)


def cache_dir() -> Path:
    """$TALKREEL_CACHE_DIR, else %LOCALAPPDATA%/talkreel/cache, $XDG_CACHE_HOME/talkreel, ~/.cache/talkreel."""
    override = os.environ.get("TALKREEL_CACHE_DIR")
    if override:
        return Path(override)
    if sys.platform == "win32" and os.environ.get("LOCALAPPDATA"):
        return Path(os.environ["LOCALAPPDATA"]) / "talkreel" / "cache"
    if os.environ.get("XDG_CACHE_HOME"):
        return Path(os.environ["XDG_CACHE_HOME"]) / "talkreel"
    return Path.home() / ".cache" / "talkreel"


def kokoro_dir() -> Path:
    return cache_dir() / "kokoro"


def _verified_marker(path: Path) -> Path:
    return path.with_name(path.name + ".sha256")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def is_present(mf: ModelFile) -> bool:
    """Present means the file exists with the pinned size and was hash-verified once."""
    path = kokoro_dir() / mf.name
    marker = _verified_marker(path)
    return (
        path.is_file()
        and path.stat().st_size == mf.size
        and marker.is_file()
        and marker.read_text(encoding="utf-8").strip() == mf.sha256
    )


def verify_local(mf: ModelFile) -> bool:
    """Hash-verify a cached copy that has no marker yet (e.g. copied in by hand). No network."""
    if is_present(mf):
        return True
    path = kokoro_dir() / mf.name
    if not (path.is_file() and path.stat().st_size == mf.size):
        return False
    print(f"verifying {path}", file=sys.stderr)
    if _sha256(path) != mf.sha256:
        print(f"{path} has the wrong SHA-256", file=sys.stderr)
        return False
    _verified_marker(path).write_text(mf.sha256 + "\n", encoding="utf-8")
    return True


def ensure(mf: ModelFile) -> Path:
    """Return the cached file, verifying an unverified copy or downloading it."""
    path = kokoro_dir() / mf.name
    if verify_local(mf):
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    print(f"downloading {mf.url} ({mf.size // 1_000_000} MB)", file=sys.stderr)
    h = hashlib.sha256()
    done = 0
    next_report = 0
    with urllib.request.urlopen(mf.url, timeout=60) as resp, tmp.open("wb") as out:
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            out.write(block)
            h.update(block)
            done += len(block)
            if done >= next_report:
                print(f"  {done * 100 // mf.size}%", file=sys.stderr, flush=True)
                next_report += mf.size // 10
    if h.hexdigest() != mf.sha256:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"{mf.name}: SHA-256 mismatch (got {h.hexdigest()}, want {mf.sha256})")
    os.replace(tmp, path)
    _verified_marker(path).write_text(mf.sha256 + "\n", encoding="utf-8")
    return path


def kokoro_paths() -> tuple[Path, Path]:
    model, voices = (ensure(mf) for mf in KOKORO_FILES)
    return model, voices


def kokoro_present() -> bool:
    return all(is_present(mf) for mf in KOKORO_FILES)


def whisper_present(model: str) -> bool:
    """True when faster-whisper's model is already in the Hugging Face cache (no network)."""
    try:
        from faster_whisper.utils import download_model
    except ImportError:
        return False
    try:
        download_model(model, local_files_only=True)
        return True
    except Exception:
        return False


def report(whisper_model: str) -> dict:
    files = [
        {"name": mf.name, "present": verify_local(mf), "path": str(kokoro_dir() / mf.name)}
        for mf in KOKORO_FILES
    ]
    return {
        "cache_dir": str(kokoro_dir()),
        "kokoro": {"present": all(f["present"] for f in files), "files": files},
        "whisper": {"present": whisper_present(whisper_model), "model": whisper_model},
    }
