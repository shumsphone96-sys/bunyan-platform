FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./app.py

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["sh","-c","gunicorn --workers 2 --threads 4 --bind 0.0.0.0:${PORT:-8080} app:app"]
