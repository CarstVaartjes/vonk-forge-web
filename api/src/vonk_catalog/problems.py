from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


@dataclass(slots=True)
class Problem(Exception):
    status: int
    code: str
    title: str
    detail: str


def install_problem_handling(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_identity(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id[:128]
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(Problem)
    async def problem_response(request: Request, problem: Problem) -> JSONResponse:
        return JSONResponse(
            status_code=problem.status,
            media_type="application/problem+json",
            content={
                "type": f"https://api.vonkforge.ai/problems/{problem.code}",
                "title": problem.title,
                "status": problem.status,
                "code": problem.code,
                "detail": problem.detail,
                "request_id": request.state.request_id,
            },
        )
