# chat/middleware.py
import json
import logging

class APILoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. LOG REQUEST (Những gì Frontend gửi lên)
        if request.path.startswith('/api/'): # Chỉ log các request API
            print(f"\n{'='*20} REQUEST START {'='*20}")
            print(f"Method: {request.method}")
            print(f"Path  : {request.path}")
            
            # Cố gắng in body dạng JSON cho đẹp
            if request.body:
                try:
                    body_data = json.loads(request.body)
                    print("Body  :")
                    print(json.dumps(body_data, indent=2, ensure_ascii=False))
                except:
                    print(f"Body (Raw): {request.body[:100]}...") # In 100 ký tự đầu nếu không phải JSON
            else:
                print("Body  : (Empty)")

        response = self.get_response(request)

        # 2. LOG RESPONSE (Những gì Backend trả về)
        if request.path.startswith('/api/'):
            print(f"\n{'-'*20} RESPONSE {'-'*20}")
            print(f"Status: {response.status_code}")
            
            # Cố gắng in content dạng JSON cho đẹp
            if response['Content-Type'] == 'application/json':
                try:
                    content_data = json.loads(response.content)
                    print("Data  :")
                    print(json.dumps(content_data, indent=2, ensure_ascii=False))
                except:
                     print(f"Data (Raw): {response.content[:100]}...")
            
            print(f"{'='*20} REQUEST END {'='*20}\n")

        return response

class MediaFrameExemptMiddleware:
    """
    Middleware này cho phép các tệp trong thư mục /media/ được nhúng qua iFrame
    mà không bị chặn bởi XFrameOptionsMiddleware của Django.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/media/'):
            # Thiết lập cờ này để XFrameOptionsMiddleware bỏ qua việc gắn X-Frame-Options: DENY
            response.xframe_options_exempt = True
        return response