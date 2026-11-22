import re
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator('email')
    @classmethod
    def email_valid(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Enter a valid email address.')
        return value


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=80)

    @field_validator('name')
    @classmethod
    def name_valid(cls, value):
        if not value.strip():
            raise ValueError('Enter your name.')
        return value.strip()


class ChatRequest(BaseModel):
    document_ids: list[int] = Field(min_length=1, max_length=20)
    question: str = Field(min_length=1, max_length=4000)
    chat_id: int | None = None


class GenerateRequest(BaseModel):
    document_ids: list[int] = Field(min_length=1, max_length=20)
    kind: Literal['summary', 'reviewer', 'flashcards', 'quiz', 'test']
    n: int = Field(default=10, ge=3, le=40)
    difficulty: Literal['easy', 'medium', 'hard'] = 'medium'
    types: list[Literal['mcq', 'true_false', 'identification']] = Field(
        default=['mcq', 'true_false', 'identification'], min_length=1, max_length=3)
    style: Literal['concise', 'detailed', 'bullet points'] = 'concise'


class Sourced(BaseModel):
    source_ids: list[str] = Field(min_length=1)


class Summary(Sourced):
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    key_points: list[str] = Field(min_length=1)


class Section(Sourced):
    heading: str = Field(min_length=1)
    points: list[str] = Field(min_length=1)


class Term(BaseModel):
    term: str = Field(min_length=1)
    definition: str = Field(min_length=1)


class Reviewer(BaseModel):
    title: str = Field(min_length=1)
    sections: list[Section] = Field(min_length=1)
    key_terms: list[Term]


class Card(Sourced):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)


class Flashcards(BaseModel):
    cards: list[Card] = Field(min_length=1)


class Question(Sourced):
    type: Literal['mcq', 'true_false', 'identification']
    question: str = Field(min_length=1)
    choices: list[str] | None = None
    answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1)

    @model_validator(mode='after')
    def valid_answer(self):
        if self.type == 'mcq' and (not self.choices or len(self.choices) != 4 or
                                   len(set(self.choices)) != 4 or self.answer not in self.choices):
            raise ValueError('MCQ needs four different choices and an exact matching answer.')
        if self.type == 'true_false' and self.answer not in ('True', 'False'):
            raise ValueError('True/false answers must be True or False.')
        return self


class Quiz(BaseModel):
    questions: list[Question] = Field(min_length=1)


class StartAttempt(BaseModel):
    study_set_id: int
    minutes: int = Field(default=30, ge=5, le=120)


class AnswerRequest(BaseModel):
    index: int = Field(ge=0)
    answer: str = Field(max_length=2000)
    version: int | None = Field(default=None, ge=0)


class RenameRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
