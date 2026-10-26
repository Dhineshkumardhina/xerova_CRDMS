# CRMS Full-Stack System Architecture

## Overview
The Crime Record Management System (CRMS) is structured as a production-ready full-stack application separating frontend user interface logic, API communication layers, and backend services.

## Directory Layout
- `frontend/`: React + TypeScript + Vite + Tailwind CSS UI application.
- `backend/`: FastAPI backend with REST endpoints, biometric face search engine, SQLAlchemy ORM models, Pydantic schemas, and JWT security.
- `database/`: Migration scripts and initial seed data generators.
- `storage/`: Encrypted local file storage for mugshots and forensic document evidence.
- `docs/`: Technical documentation and API specifications.
