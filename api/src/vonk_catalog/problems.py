from __future__ import annotations

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
