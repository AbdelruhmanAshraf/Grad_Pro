from __future__ import annotations

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from threading import Lock
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from .core.config import get_settings
from .llm import router as llm_router
from .schemas import (
    ClassificationResult,
    Exercise,
    FrameRequest,
    FrameResponse,
    SecurityEventRequest,
    SessionEndRequest,
    SessionEndResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionStatusResponse,
    WorkoutMetrics,
)
from .security import (
    FirebaseUser,
    assert_frame_payload_size,
    assert_payload_size,
    firebase_user,
    rate_limit,
    redact_uid,
)
from .services.classifier import (
    Classification,
    ClassifierNotReadyError,
    ExerciseClassifier,
)
from .services.exercise_catalog import get_catalog
from .services.pose import PoseService, decode_frame, encode_frame_as_data_url
from .services.rep_counter import RepCounter
from .services.sessions import SessionManager, SessionNotFoundError, WorkoutSession

MODEL_VERSION = "22ex_bilstm_v1"

settings = get_settings()


# --------------------------------------------------------------------------- #
# Active-session counter (session_max_active enforcement, without touching
# services/sessions.py per hardening plan §7d).
# --------------------------------------------------------------------------- #

_active_sessions = 0
_active_lock = Lock()


def _bump_active(delta: int) -> None:
    global _active_sessions
    with _active_lock:
        _active_sessions = max(0, _active_sessions + delta)


def _active_count() -> int:
    with _active_lock:
        return _active_sessions


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _log_startup_state()
    task = asyncio.create_task(_session_cleanup_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def _session_cleanup_loop() -> None:
    """Periodically evict idle / over-aged in-memory sessions."""
    interval = max(10, settings.session_cleanup_interval_s)
    while True:
        try:
            await asyncio.sleep(interval)
            removed = session_manager.sweep_stale(
                idle_timeout_s=settings.session_idle_timeout_s,
                max_age_s=settings.session_max_age_s,
            )
            if removed:
                _bump_active(-removed)
                print(
                    f"[sessions] cleanup evicted {removed} stale sessions "
                    f"(active={_active_count()})",
                    flush=True,
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover
            print(f"[sessions] cleanup error: {exc}", flush=True)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Webcam-only AI fitness coaching backend for pose detection, "
        "continuous exercise classification, rep counting, and workout sessions."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    """Structured request log: method, path, redacted uid, status, latency.

    No bodies, no tokens. `request.state.uid` is set by `firebase_user` when
    the request passes auth; unauth or pre-auth requests log uid=-.
    """
    start = time.monotonic()
    rid = uuid.uuid4().hex[:8]
    try:
        response: Response = await call_next(request)
    except Exception:
        dur_ms = (time.monotonic() - start) * 1000
        uid = getattr(request.state, "uid", None)
        print(
            f"[req {rid}] {request.method} {request.url.path} "
            f"uid={redact_uid(uid)} status=EXC {dur_ms:.1f}ms",
            flush=True,
        )
        raise
    dur_ms = (time.monotonic() - start) * 1000
    uid = getattr(request.state, "uid", None)
    print(
        f"[req {rid}] {request.method} {request.url.path} "
        f"uid={redact_uid(uid)} status={response.status_code} {dur_ms:.1f}ms",
        flush=True,
    )
    return response


app.include_router(llm_router)


pose_service = PoseService()
classifier = ExerciseClassifier(
    model_path=settings.model_path,
    scaler_path=settings.scaler_path,
    label_encoder_path=settings.label_encoder_path,
    window_size=settings.classifier_window_size,
    feature_count=settings.classifier_feature_count,
)
session_manager = SessionManager(classifier=classifier)
rep_counter_registry = RepCounter()


def _classification_response(classification: Classification) -> ClassificationResult:
    return ClassificationResult(**classification.to_dict())


def _metrics_response(session: WorkoutSession) -> WorkoutMetrics:
    return WorkoutMetrics(**session_manager.metrics(session))


def _supported_exercises() -> List[str]:
    return sorted(
        set(classifier.supported_exercises())
        | set(rep_counter_registry.supported_exercises())
    )


def _get_session_or_404(session_id: str) -> WorkoutSession:
    try:
        return session_manager.get(session_id)
    except SessionNotFoundError:
        raise HTTPException(status_code=404, detail="Workout session not found.")


def _assert_owner(session: WorkoutSession, user: FirebaseUser) -> None:
    """Reject requests for a session that belongs to a different user.

    Anonymous-mode sessions (dev only) skip ownership checks because we have
    no stable uid to bind them to.
    """
    if session.owner_uid is None or user.anonymous:
        return
    if session.owner_uid != user.uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to the authenticated user.",
        )


def _log_startup_state() -> None:
    """Print a single block confirming every artifact loaded at boot."""
    classifier_loaded = classifier.is_ready
    scaler_loaded = classifier.scaler is not None
    encoder_loaded = classifier.label_encoder is not None
    classes = list(classifier.exercise_classes)
    exercises = _supported_exercises()
    lines = [
        "",
        "=" * 60,
        f"  {settings.app_name} starting up",
        "=" * 60,
        f"  Model Loaded:    {settings.model_path.name}",
        f"  Scaler Loaded:   {settings.scaler_path.name}",
        f"  Encoder Loaded:  {settings.label_encoder_path.name}",
        f"  Classifier ready: {classifier_loaded}",
        f"  Scaler ready:    {scaler_loaded}",
        f"  Encoder ready:   {encoder_loaded}",
        f"  Classes:         {len(classes)}",
        f"  Model version:   {MODEL_VERSION}",
        f"  Exercises:       {', '.join(exercises) if exercises else '(none)'}",
        f"  CORS origins:    {', '.join(settings.cors_origins)}",
        f"  Session cap:     {settings.session_max_active} active max",
    ]
    if classifier.load_error:
        lines.append(f"  Load error:      {classifier.load_error}")
    lines.append("=" * 60)
    lines.append("")
    print("\n".join(lines), flush=True)


@app.get("/api/health")
def health() -> Dict[str, object]:
    """Liveness and readiness probe (unauthenticated by design)."""
    classifier_loaded = classifier.is_ready
    status_str = "healthy" if classifier_loaded else "degraded"
    response: Dict[str, object] = {
        "status": status_str,
        "classifier_loaded": classifier_loaded,
        "model_version": MODEL_VERSION,
        "num_classes": len(classifier.exercise_classes),
        "supported_exercises": _supported_exercises(),
    }
    if classifier.load_error:
        response["classifier_error"] = classifier.load_error
    return response


@app.get("/api/exercises", response_model=List[Exercise])
def list_exercises(
    _user: FirebaseUser = Depends(firebase_user),
) -> List[Exercise]:
    """Return the 22-exercise display catalog backed by the classifier label set."""
    classifier_ids = set(classifier.exercise_classes) if classifier.is_ready else None
    catalog = get_catalog()
    if classifier_ids is not None:
        catalog = [entry for entry in catalog if entry["id"] in classifier_ids]
        for label in sorted(classifier_ids - {entry["id"] for entry in catalog}):
            catalog.append(
                {
                    "id": label,
                    "name": label.replace("_", " ").title(),
                    "category": "Other",
                    "target_muscle": "Unknown",
                    "difficulty": "Intermediate",
                }
            )
    return [Exercise(**entry) for entry in catalog]


@app.post("/api/session/start", response_model=SessionStartResponse)
def start_session(
    payload: SessionStartRequest,
    _size: None = Depends(assert_payload_size),
    user: FirebaseUser = Depends(rate_limit("session")),
) -> SessionStartResponse:
    if _active_count() >= settings.session_max_active:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session capacity reached. Try again shortly.",
        )
    session = session_manager.start(
        exercise=payload.exercise,
        sets=payload.sets,
        target_reps=payload.target_reps,
        rest_timer=payload.rest_timer,
        owner_uid=user.uid,
    )
    _bump_active(+1)
    return SessionStartResponse(
        session_id=session.session_id,
        metrics=_metrics_response(session),
        supported_exercises=_supported_exercises(),
    )


@app.post("/api/frame", response_model=FrameResponse)
def process_frame(
    payload: FrameRequest,
    _size: None = Depends(assert_frame_payload_size),
    user: FirebaseUser = Depends(rate_limit("frame")),
) -> FrameResponse:
    session = _get_session_or_404(payload.session_id)
    _assert_owner(session, user)

    if not session.active or session.ended_at is not None:
        raise HTTPException(status_code=409, detail="Workout session has ended.")

    session_manager.touch(session)

    try:
        frame = decode_frame(payload.image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    feedback: List[str] = []
    pose_detection = pose_service.process(frame, draw=payload.return_annotated_frame)
    classification: Classification = session.last_classification

    if not pose_detection.pose_detected:
        feedback.append("No pose detected. Step fully into the camera frame.")
    else:
        try:
            classification = classifier.predict(
                pose_detection.relevant_landmarks,
                state=session.classifier_state,
            )
        except ClassifierNotReadyError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        session_manager.record_classification(
            session,
            classification,
            confidence_threshold=settings.classification_confidence_threshold,
        )

        if not classification.ready:
            feedback.append(
                classification.message or "Collecting frames for classification."
            )

        active_exercise: Optional[str] = session.exercise
        if active_exercise:
            rep_result = session.rep_counter.update(
                active_exercise,
                pose_detection.pixel_landmarks,
            )
            session_manager.record_repetition(session, rep_result)
            feedback.extend(rep_result.feedback)
            if rep_result.delta > 0:
                feedback.append(f"Rep counted for {rep_result.exercise}.")
        else:
            feedback.append("Waiting for exercise classification before counting reps.")

    session_manager.record_pose_status(session, pose_detection.pose_detected)
    metrics_dict = session_manager.metrics(session)
    annotated_frame: Optional[str] = None
    if payload.return_annotated_frame:
        try:
            annotated_frame = encode_frame_as_data_url(pose_detection.annotated_frame)
        except ValueError as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    return FrameResponse(
        session_id=session.session_id,
        pose_detected=pose_detection.pose_detected,
        classification=_classification_response(classification),
        metrics=WorkoutMetrics(**metrics_dict),
        feedback=feedback,
        annotated_frame=annotated_frame,
    )


@app.get("/api/session/status", response_model=SessionStatusResponse)
def session_status(
    session_id: str = Query(..., min_length=1, max_length=64),
    user: FirebaseUser = Depends(rate_limit("session")),
) -> SessionStatusResponse:
    session = _get_session_or_404(session_id)
    _assert_owner(session, user)
    return SessionStatusResponse(
        session_id=session.session_id,
        metrics=_metrics_response(session),
        classification=_classification_response(session.last_classification),
        pose_detected=session.last_pose_detected,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_seconds=session_manager.duration_seconds(session),
    )


@app.post("/api/session/end", response_model=SessionEndResponse)
def end_session(
    payload: SessionEndRequest,
    _size: None = Depends(assert_payload_size),
    user: FirebaseUser = Depends(rate_limit("session")),
) -> SessionEndResponse:
    session = _get_session_or_404(payload.session_id)
    _assert_owner(session, user)
    session_manager.end(session.session_id)
    _bump_active(-1)
    return SessionEndResponse(
        session_id=session.session_id,
        metrics=_metrics_response(session),
        duration_seconds=session_manager.duration_seconds(session),
    )


@app.post("/api/security/event", status_code=204)
async def security_event(
    event: SecurityEventRequest,
    user: FirebaseUser = Depends(rate_limit("security_event")),
) -> Response:
    """Client-reported security event (failed login, AI failure, rate-limit hit).

    Body already sanitised on the client (see src/lib/securityLog.ts). Never
    log tokens or keys — the `detail` field is capped at 200 chars.
    """
    detail = (event.detail or "")[:200]
    print(
        f"[sec] uid={redact_uid(user.uid)} type={event.type} detail={detail!r}",
        flush=True,
    )
    return Response(status_code=204)
