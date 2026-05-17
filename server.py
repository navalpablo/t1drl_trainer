"""
T1-DRL submission collector.

Small FastAPI app that receives per-lesion answers from the static
T1-DRL training portal and stores them in SQLite. Designed to run on a
Raspberry Pi behind Cloudflare Tunnel.

Public URL (via Cloudflare Tunnel ingress rule):
  https://api.navalbaudin.com/t1drl/*  ->  http://127.0.0.1:8181/t1drl/*

Endpoints (all under /t1drl):
  GET  /health              public, returns {"ok": true}
  POST /submit              public, stores one submission + its answers
  GET  /stats               requires X-Admin-Token header
  GET  /export.csv          requires X-Admin-Token header

Environment variables (typically set in /etc/t1drl/env):
  T1DRL_DB              SQLite path. Default: /var/lib/t1drl/submissions.db
  T1DRL_ADMIN_TOKEN     Required to access /stats and /export.csv.
  T1DRL_IP_SALT         Salt used to hash IPs (for rate limiting only).
                        Generate once and keep stable, e.g.:
                          python3 -c 'import secrets; print(secrets.token_hex(32))'
  T1DRL_CORS_ORIGINS    Comma-separated allowed Origin values.
                        Default: https://navalpablo.github.io
  T1DRL_PORT            HTTP port to listen on. Default: 8181

Install on the Pi (see also t1drl-collector.service and
cloudflared-config.example.yml in this directory).
"""

import csv
import hashlib
import io
import os
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


DB_PATH = os.environ.get("T1DRL_DB", "/var/lib/t1drl/submissions.db")
ADMIN_TOKEN = os.environ.get("T1DRL_ADMIN_TOKEN", "")
IP_SALT = os.environ.get("T1DRL_IP_SALT") or secrets.token_hex(16)
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "T1DRL_CORS_ORIGINS", "https://navalpablo.github.io"
    ).split(",")
    if o.strip()
]

Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

_conn = sqlite3.connect(DB_PATH, isolation_level=None, check_same_thread=False)
_conn.execute("PRAGMA journal_mode=WAL")
_conn.execute("PRAGMA foreign_keys=ON")
_conn.executescript(
    """
    CREATE TABLE IF NOT EXISTS submissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      anon_id     TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      batch_name  TEXT NOT NULL,
      name        TEXT,
      email       TEXT,
      center      TEXT,
      role        TEXT,
      tp          INTEGER,
      tn          INTEGER,
      fp          INTEGER,
      fn          INTEGER,
      accuracy    REAL,
      sensitivity REAL,
      specificity REAL,
      user_agent  TEXT,
      ip_hash     TEXT
    );
    CREATE TABLE IF NOT EXISTS answers (
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      lesion_id     TEXT NOT NULL,
      gold          TEXT NOT NULL,
      given         TEXT NOT NULL,
      correct       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subs_anon    ON submissions(anon_id);
    CREATE INDEX IF NOT EXISTS idx_subs_batch   ON submissions(batch_name);
    CREATE INDEX IF NOT EXISTS idx_subs_created ON submissions(created_at);
    CREATE INDEX IF NOT EXISTS idx_answers_sub  ON answers(submission_id);
    """
)
_write_lock = threading.Lock()


_rate_buckets: dict = {}
_rate_lock = threading.Lock()


def rate_limit(ip_hash: str, limit: int = 30, window_seconds: int = 60) -> None:
    now = time.time()
    with _rate_lock:
        bucket = _rate_buckets.setdefault(ip_hash, [])
        bucket[:] = [t for t in bucket if t > now - window_seconds]
        if len(bucket) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests")
        bucket.append(now)


class AnswerIn(BaseModel):
    lesion_id: str = Field(min_length=1, max_length=64)
    gold: str = Field(pattern=r"^(True|False)$")
    given: str = Field(pattern=r"^(True|False)$")
    correct: bool


class SubmissionIn(BaseModel):
    anon_id: str = Field(min_length=8, max_length=64)
    batch_name: str = Field(min_length=1, max_length=160)
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=160)
    center: Optional[str] = Field(default=None, max_length=160)
    role: Optional[str] = Field(default=None, max_length=80)
    tp: int = 0
    tn: int = 0
    fp: int = 0
    fn: int = 0
    accuracy: float = 0.0
    sensitivity: Optional[float] = None
    specificity: Optional[float] = None
    answers: List[AnswerIn] = Field(default_factory=list)


def client_ip(request: Request) -> str:
    return (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "")
        or "0.0.0.0"
    )


def hash_ip(ip: str) -> str:
    return hashlib.sha256((ip + IP_SALT).encode()).hexdigest()[:32]


def require_token(x_admin_token: str = Header(default="")) -> None:
    if not ADMIN_TOKEN or not secrets.compare_digest(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


app = FastAPI(title="T1-DRL Collector", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Admin-Token"],
    max_age=86400,
)

router = APIRouter(prefix="/t1drl")


@router.get("/health")
def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


@router.post("/submit")
def submit(payload: SubmissionIn, request: Request):
    ip = client_ip(request)
    ih = hash_ip(ip)
    rate_limit(ih)

    if len(payload.answers) > 200:
        raise HTTPException(status_code=400, detail="Too many answers in one submission")

    user_agent = (request.headers.get("user-agent") or "")[:200]
    created = datetime.now(timezone.utc).isoformat()

    with _write_lock:
        cur = _conn.execute(
            """
            INSERT INTO submissions(
              anon_id, created_at, batch_name,
              name, email, center, role,
              tp, tn, fp, fn,
              accuracy, sensitivity, specificity,
              user_agent, ip_hash
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                payload.anon_id,
                created,
                payload.batch_name,
                payload.name or None,
                payload.email or None,
                payload.center or None,
                payload.role or None,
                payload.tp,
                payload.tn,
                payload.fp,
                payload.fn,
                payload.accuracy,
                payload.sensitivity,
                payload.specificity,
                user_agent,
                ih,
            ),
        )
        sub_id = cur.lastrowid
        if payload.answers:
            _conn.executemany(
                "INSERT INTO answers(submission_id, lesion_id, gold, given, correct) "
                "VALUES (?,?,?,?,?)",
                [
                    (sub_id, a.lesion_id, a.gold, a.given, 1 if a.correct else 0)
                    for a in payload.answers
                ],
            )

    return {"ok": True, "id": sub_id}


@router.get("/stats", dependencies=[Depends(require_token)])
def stats():
    submissions = _conn.execute("SELECT COUNT(*) FROM submissions").fetchone()[0]
    answers = _conn.execute("SELECT COUNT(*) FROM answers").fetchone()[0]
    users = _conn.execute("SELECT COUNT(DISTINCT anon_id) FROM submissions").fetchone()[0]
    by_batch = dict(
        _conn.execute(
            "SELECT batch_name, COUNT(*) FROM submissions GROUP BY batch_name ORDER BY 1"
        ).fetchall()
    )
    last = _conn.execute(
        "SELECT created_at FROM submissions ORDER BY id DESC LIMIT 1"
    ).fetchone()
    return {
        "submissions": submissions,
        "answers": answers,
        "unique_anon": users,
        "by_batch": by_batch,
        "last_submission_at": last[0] if last else None,
    }


@router.get("/export.csv", dependencies=[Depends(require_token)])
def export_csv():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "submission_id", "created_at", "batch_name", "anon_id",
            "name", "email", "center", "role",
            "lesion_id", "gold", "given", "correct",
            "tp", "tn", "fp", "fn",
            "accuracy", "sensitivity", "specificity",
        ]
    )
    for row in _conn.execute(
        """
        SELECT s.id, s.created_at, s.batch_name, s.anon_id,
               s.name, s.email, s.center, s.role,
               a.lesion_id, a.gold, a.given, a.correct,
               s.tp, s.tn, s.fp, s.fn,
               s.accuracy, s.sensitivity, s.specificity
          FROM submissions s
          LEFT JOIN answers a ON a.submission_id = s.id
         ORDER BY s.id, a.lesion_id
        """
    ):
        writer.writerow(row)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=t1drl_submissions.csv"},
    )


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("T1DRL_PORT", "8181"))
    uvicorn.run(app, host="127.0.0.1", port=port)
