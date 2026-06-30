FROM python:3.12-slim

WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Cài đặt Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code
COPY . .

EXPOSE 8000

# Chạy server với collectstatic (dùng cho Dev/Staging)
CMD ["sh", "-c", "python manage.py collectstatic --noinput && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
