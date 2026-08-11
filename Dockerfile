FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8000
WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --upgrade pip && python -m pip install -r requirements.txt

COPY . ./

RUN chmod +x ./start.sh
RUN python manage.py collectstatic --noinput

EXPOSE 8000
ENTRYPOINT ["/app/start.sh"]
