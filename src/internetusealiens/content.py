"""Завантаження та валідація контенту курсу (лише stdlib)."""
from __future__ import annotations

import json
from pathlib import Path

QUESTION_TYPES = {"single", "multi", "truefalse"}
MIN_QUESTIONS = 5


def load_course(content_dir: Path) -> dict:
    course = json.loads((content_dir / "course.json").read_text(encoding="utf-8"))
    modules = []
    for mod_id in course["modules"]:
        mod_dir = content_dir / "modules" / mod_id
        lesson = (mod_dir / "lesson.md").read_text(encoding="utf-8")
        quiz = json.loads((mod_dir / "quiz.json").read_text(encoding="utf-8"))
        modules.append({"id": mod_id, "lesson": lesson, "questions": quiz["questions"]})
    trainer_file = content_dir / "trainer.json"
    trainer = json.loads(trainer_file.read_text(encoding="utf-8"))["items"] if trainer_file.exists() else []
    return {**course, "modules": modules, "trainer": trainer}


def validate_question(q: dict) -> list[str]:
    errors: list[str] = []
    qid = q.get("id", "<без id>")
    for key in ("id", "type", "text", "answer", "explanation"):
        if key not in q:
            errors.append(f"{qid}: відсутнє поле '{key}'")
    if errors:
        return errors
    if not str(q["explanation"]).strip():
        return [f"{qid}: порожнє пояснення"]
    t = q["type"]
    if t not in QUESTION_TYPES:
        return [f"{qid}: невідомий тип '{t}'"]
    if t == "truefalse":
        if not isinstance(q["answer"], bool):
            errors.append(f"{qid}: answer має бути true/false")
        return errors
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        return [f"{qid}: потрібно щонайменше 2 options"]
    ans = q["answer"]
    if not isinstance(ans, list) or not ans:
        errors.append(f"{qid}: answer має бути непорожнім списком індексів")
    elif not all(isinstance(i, int) and 0 <= i < len(opts) for i in ans):
        errors.append(f"{qid}: індекс відповіді поза межами options")
    elif t == "single" and len(ans) != 1:
        errors.append(f"{qid}: для 'single' потрібна рівно одна відповідь")
    return errors


def validate_trainer_item(t: dict) -> list[str]:
    tid = t.get("id", "<без id>")
    errors = [f"{tid}: відсутнє поле '{k}'" for k in ("id", "kind", "from", "text", "scam", "explanation") if k not in t]
    if not errors and not isinstance(t["scam"], bool):
        errors.append(f"{tid}: scam має бути true/false")
    return errors


def validate_course(content_dir: Path) -> list[str]:
    errors: list[str] = []
    try:
        course = load_course(content_dir)
    except (OSError, KeyError, json.JSONDecodeError) as e:
        return [f"Не вдалося завантажити курс: {e!r}"]
    seen: set[str] = set()
    for mod in course["modules"]:
        if not mod["lesson"].lstrip().startswith("# "):
            errors.append(f"{mod['id']}: урок має починатися із заголовка '# '")
        if len(mod["questions"]) < MIN_QUESTIONS:
            errors.append(f"{mod['id']}: у тесті менше {MIN_QUESTIONS} питань")
        if "## Практика" not in mod["lesson"]:
            errors.append(f"{mod['id']}: в уроці немає розділу '## Практика'")
        for q in mod["questions"]:
            errors.extend(validate_question(q))
            if q.get("id") in seen:
                errors.append(f"{q.get('id')}: дубльований id")
            seen.add(q.get("id"))
    exam_n = course.get("exam", {}).get("questions", 0)
    if exam_n > len(seen):
        errors.append(f"exam.questions ({exam_n}) більше за банк питань ({len(seen)})")
    trainer = course["trainer"]
    for t in trainer:
        errors.extend(validate_trainer_item(t))
    kinds = {t.get("scam") for t in trainer}
    if trainer and kinds != {True, False}:
        errors.append("тренажер має містити і шахрайські, і безпечні приклади")
    return errors
