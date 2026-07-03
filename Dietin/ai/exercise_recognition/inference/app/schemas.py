from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Exercise(BaseModel):
    id: str = Field(..., description="Classifier label, e.g. barbell_biceps_curl.")
    name: str
    category: str
    target_muscle: str
    difficulty: Literal["Beginner", "Intermediate", "Advanced"]


class SessionStartRequest(BaseModel):
    exercise: Optional[str] = Field(
        default=None,
        max_length=60,
        description="Optional initial exercise hint. Live classification can override it.",
    )
    sets: int = Field(default=1, ge=1, le=50)
    target_reps: int = Field(default=12, ge=1, le=200)
    rest_timer: int = Field(
        default=60, ge=0, le=3600, description="Rest timer in seconds between sets."
    )


class SessionEndRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)


class FrameRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    image: str = Field(
        ...,
        min_length=1,
        max_length=1_400_000,
        description="Base64 encoded webcam frame. Raw base64 and data:image/... URLs are supported.",
    )
    return_annotated_frame: bool = Field(
        default=True,
        description="Return the frame with pose landmarks and metrics overlay as a JPEG data URL.",
    )


class ClassificationResult(BaseModel):
    exercise: Optional[str] = None
    confidence: float = 0.0
    raw_label: Optional[str] = None
    ready: bool = False
    stable_prediction: bool = False
    message: Optional[str] = None


class WorkoutMetrics(BaseModel):
    exercise: Optional[str] = None
    sets: int
    target_reps: int
    completed_reps: int
    current_set: int
    rest_timer: int
    rest_remaining: int = 0
    total_reps: int = 0
    active: bool = True
    session_complete: bool = False
    exercise_totals: Dict[str, int] = Field(default_factory=dict)


class SessionStartResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    supported_exercises: List[str]


class FrameResponse(BaseModel):
    session_id: str
    pose_detected: bool
    classification: ClassificationResult
    metrics: WorkoutMetrics
    feedback: List[str] = Field(default_factory=list)
    annotated_frame: Optional[str] = None


class SessionStatusResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    classification: ClassificationResult
    pose_detected: bool
    started_at: float
    ended_at: Optional[float] = None
    duration_seconds: float


class SessionEndResponse(BaseModel):
    session_id: str
    metrics: WorkoutMetrics
    duration_seconds: float


# --------------------------------------------------------------------------- #
# LLM proxy (Kimi 2.5 via DigitalOcean)
# --------------------------------------------------------------------------- #

MAX_PROMPT_CHARS = 4000
MAX_SYSTEM_CHARS = 2000
MAX_IMAGE_B64 = 1_400_000  # ~1 MB decoded

LLMTask = Literal[
    "nutrition",
    "food_validation",
    "image_food_validation",
    "image_description",
    "meal_suggestion",
    "hydration_tip",
    "name_validation",
    "weekly_report",
    "generic",
]


class LLMChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_CHARS)
    system: Optional[str] = Field(default=None, max_length=MAX_SYSTEM_CHARS)
    mode: Literal["json", "text"] = "text"
    task: LLMTask = "generic"
    image_base64: Optional[str] = Field(default=None, max_length=MAX_IMAGE_B64)
    image_mime: Optional[Literal["image/jpeg", "image/png", "image/webp"]] = None


class LLMChatResponse(BaseModel):
    mode: Literal["json", "text"]
    text: Optional[str] = None
    json_payload: Optional[Dict[str, Any]] = Field(default=None, alias="json")

    model_config = {"populate_by_name": True}


class NutritionOut(BaseModel):
    calories: float = Field(ge=0, le=5000)
    protein: float = Field(ge=0, le=500)
    carbs: float = Field(ge=0, le=1000)
    fat: float = Field(ge=0, le=500)
    healthScore: float = Field(ge=0, le=100)
    warning: Optional[str] = Field(default=None, max_length=300)


class FoodValidationOut(BaseModel):
    isFood: bool
    reason: Optional[str] = Field(default=None, max_length=200)


class ImageDescriptionOut(BaseModel):
    description: str = Field(min_length=1, max_length=2000)


class SecurityEventRequest(BaseModel):
    type: Literal[
        "login_failed", "ai_failure", "rate_limit_hit", "validation_error"
    ]
    detail: str = Field(default="", max_length=200)
    at: float = Field(default=0.0, ge=0)
