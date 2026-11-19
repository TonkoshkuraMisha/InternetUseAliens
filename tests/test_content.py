import unittest
from pathlib import Path

from internetusealiens.content import (
    MIN_QUESTIONS, load_course, validate_course, validate_question, validate_trainer_item,
)

CONTENT = Path(__file__).resolve().parents[1] / "content"


class ContentTests(unittest.TestCase):
    def test_real_course_is_valid(self):
        self.assertEqual(validate_course(CONTENT), [])

    def test_every_module_listed_has_enough_questions(self):
        course = load_course(CONTENT)
        self.assertGreaterEqual(len(course["modules"]), 11)
        for m in course["modules"]:
            self.assertGreaterEqual(len(m["questions"]), MIN_QUESTIONS, m["id"])

    def test_question_ids_unique_and_match_module(self):
        course = load_course(CONTENT)
        ids = [q["id"] for m in course["modules"] for q in m["questions"]]
        self.assertEqual(len(ids), len(set(ids)))
        for m in course["modules"]:
            prefix = "m" + m["id"][:2] + "-"
            for q in m["questions"]:
                self.assertTrue(q["id"].startswith(prefix), q["id"])

    def test_exam_fits_question_bank(self):
        course = load_course(CONTENT)
        bank = sum(len(m["questions"]) for m in course["modules"])
        self.assertLessEqual(course["exam"]["questions"], bank)

    def test_trainer_has_both_kinds(self):
        trainer = load_course(CONTENT)["trainer"]
        self.assertTrue(any(t["scam"] for t in trainer))
        self.assertTrue(any(not t["scam"] for t in trainer))

    def test_bad_index(self):
        q = {"id": "x", "type": "single", "text": "?", "options": ["a", "b"], "answer": [5], "explanation": "e"}
        self.assertTrue(validate_question(q))

    def test_single_needs_one_answer(self):
        q = {"id": "x", "type": "single", "text": "?", "options": ["a", "b"], "answer": [0, 1], "explanation": "e"}
        self.assertTrue(validate_question(q))

    def test_empty_explanation_rejected(self):
        q = {"id": "x", "type": "truefalse", "text": "?", "answer": True, "explanation": "  "}
        self.assertTrue(validate_question(q))

    def test_truefalse_ok(self):
        q = {"id": "x", "type": "truefalse", "text": "?", "answer": True, "explanation": "e"}
        self.assertEqual(validate_question(q), [])

    def test_trainer_item_validation(self):
        self.assertTrue(validate_trainer_item({"id": "t"}))
        ok = {"id": "t", "kind": "SMS", "from": "x", "text": "y", "scam": True, "explanation": "z"}
        self.assertEqual(validate_trainer_item(ok), [])


if __name__ == "__main__":
    unittest.main()
