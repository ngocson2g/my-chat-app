# chat/utils.py
import redis
from django.conf import settings

class RedisClient:
    _instance = None

    @classmethod
    def get_client(cls):
        if cls._instance is None:
            # Khởi tạo kết nối 1 lần duy nhất (Singleton)
            cls._instance = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=0, # Hoặc lấy từ settings
                decode_responses=True # Tùy chọn: để nhận về string thay vì bytes
            )
        return cls._instance