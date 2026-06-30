# Tài Liệu Kiến Trúc Hệ Thống (System Architecture)

*Lưu ý: Tất cả các sơ đồ trực quan (Sơ đồ lớp, Sơ đồ kiến trúc, Sơ đồ tuần tự) đã được tách sang file **`System_Diagrams.md`**. Vui lòng mở file đó để đối chiếu khi đọc tài liệu này.*

---

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

Hệ thống được thiết kế theo mô hình **Microservices-oriented / Service-Oriented Architecture (SOA)**, tách biệt hoàn toàn giữa xử lý nghiệp vụ HTTP tĩnh và xử lý kết nối Realtime.
- **Frontend Web App:** Ứng dụng trung tâm chạy trên trình duyệt.
- **Mobile App:** Ứng dụng di động đa nền tảng (iOS/Android) dùng chung logic với Web (chỉ nêu ở cấp độ tổng quan, dùng React Native/Expo để tận dụng hệ sinh thái JS).
- **Backend API Server:** Viết bằng Python/Django, chuyên trách xử lý nghiệp vụ, kiểm tra bảo mật và thao tác Database.
- **WebSocket Server:** Viết bằng Rust/Actix, một service siêu nhẹ, siêu nhanh chuyên chịu tải hàng chục ngàn kết nối song song.

---

## 2. Công Nghệ Sử Dụng (Tech Stack)

Phần này tập trung phân tích sâu vào hệ thống Web và Server, đánh giá rạch ròi lý do, bài toán giải quyết và các luồng xử lý Đồng bộ/Bất đồng bộ.

### 2.1 Frontend Web (React 19 & Vite)
- **Lý do sử dụng:** Giao diện Chat đòi hỏi sự tương tác tức thì và thay đổi liên tục trên cùng một trang (Single Page Application). React sinh ra để giải quyết bài toán giao diện động phức tạp này.
- **Giải quyết bài toán gì & Mức độ đáp ứng:**
  - **Tối ưu Render (Virtual DOM):** Khi có một tin nhắn mới được nhận từ WebSocket, chỉ đúng đoạn tin nhắn đó được vẽ (render) lại trên màn hình, không làm tải lại cả trang hay giật lag danh sách hàng ngàn tin nhắn cũ.
  - **Trải nghiệm Developer (DX):** Sử dụng Vite thay cho Webpack giúp thời gian khởi động server dev giảm từ hàng chục giây xuống chỉ còn vài mili-giây (HMR siêu tốc).
- **So sánh thay thế:** Có thể dùng Vue 3, nhưng React vượt trội ở hệ sinh thái thư viện (rich text editor, emoji picker, auto-scroll) phong phú hơn hẳn.

### 2.2 Backend API Server (Django & Django REST Framework)
- **Lý do sử dụng:** Quản lý cơ sở dữ liệu quan hệ (User, Room, Phân quyền) cần một ORM (Object-Relational Mapping) chặt chẽ. Django cung cấp khung bảo mật (auth) và ORM tốt nhất hiện nay.
- **Giải quyết bài toán gì:** Đẩy nhanh tiến độ dự án. Thay vì tự viết middleware chống XSS, CSRF, Injection như trong Express.js (Node.js), Django xử lý tự động, giúp dev tập trung vào logic nghiệp vụ cốt lõi.

### 2.3 WebSocket Service (Rust, Actix)
- **Lý do sử dụng:** Node.js hay Python tốn rất nhiều tài nguyên (RAM) cho mỗi kết nối mạng giữ liên tục. Rust xử lý I/O mạng tận dụng tối đa CPU mà không có Garbage Collector (tránh tình trạng khựng/lag server khi dọn rác).
- **Giải quyết bài toán gì:** Tách bạch rủi ro (Fault Isolation). Nếu hệ thống WebSocket sập do quá tải, người dùng vẫn có thể đăng nhập, xem lịch sử chat và gửi tin nhắn (dù không realtime được) qua API của Django. Nếu gộp chung, hệ thống sập là tê liệt toàn bộ.

### 2.4 Database, Message Broker & Storage
- **PostgreSQL:** Chứa dữ liệu bền vững.
- **Redis (Pub/Sub):** Cầu nối giao tiếp "tốc độ ánh sáng" trên RAM giữa Django và Rust.
- **File Storage (Tương lai tích hợp S3/Cloudflare R2):** Lưu trữ file đính kèm tách biệt để đảm bảo Database PostgreSQL không bị phình to do chứa dữ liệu nhị phân (Binary data).

---

## 3. Luồng Gửi Nhận Tin Nhắn & Xử Lý Đồng Bộ / Bất Đồng Bộ

Để hệ thống mượt mà và không bắt người dùng phải chờ đợi, luồng gửi/nhận tin nhắn được phân tách rạch ròi thành 2 quá trình: **Đồng bộ (Synchronous)** và **Bất đồng bộ (Asynchronous)**.

### Bước 1: Xử lý Đồng bộ (Synchronous) - Giao tiếp Client & API
*Đây là luồng chặn (blocking), hệ thống phải làm xong mới phản hồi cho người gửi.*
1. Người gửi (Frontend Web) gọi `POST /api/messages` chứa `room_id` và nội dung tin nhắn.
2. Nginx điều hướng request vào Django Backend.
3. Django kiểm tra Token, xác minh User có nằm trong `room_id` này không.
4. Django lưu tin nhắn vào PostgreSQL.
5. **Phản hồi ngay lập tức:** Django trả về mã `201 Created` cho người gửi. Giao diện Web lập tức hiển thị tin nhắn ở trạng thái "Đã gửi".

### Bước 2: Xử lý Bất đồng bộ (Asynchronous) - Realtime & Notification
*Sau khi lưu DB xong, Backend sẽ đẩy các tiến trình tốn thời gian ra chạy nền (background) để giải phóng kết nối cho API. Quá trình này diễn ra song song.*
1. **Push vào Redis (Message Broker):** Django bắn một sự kiện (Event) chứa nội dung tin nhắn vào kênh `chat_room_<id>` của Redis. Tiến trình này mất chưa tới 1ms và không yêu cầu chờ kết quả.
2. **WebSocket Broadcast:** 
   - Server Rust (đang lắng nghe Redis) ngay lập tức chộp lấy sự kiện này.
   - Rust quét trong bộ nhớ RAM danh sách các Client đang giữ kết nối (socket) thuộc về `room_id` đó.
   - Rust đẩy gói tin JSON chứa tin nhắn mới thẳng xuống trình duyệt của những người nhận.
   - Trình duyệt dùng React update UI mượt mà.
3. **Gửi Push Notification (FCM):**
   - Song song với việc đẩy Redis, Django kiểm tra xem có User nào trong phòng đang Offline (hoặc thu nhỏ trình duyệt/app) không.
   - Nếu có, hệ thống (thường thông qua Celery Worker) sẽ gọi API của Firebase Cloud Messaging (FCM). Đây là tác vụ I/O tốn thời gian nên bắt buộc phải chạy bất đồng bộ để không làm chậm API `POST` ở Bước 1.

---

## 4. Chiến Lược Bảo Mật Token (Token Storage Strategy)

Hệ thống sử dụng cơ chế bảo mật kép **HttpOnly Cookie + In-Memory State** thay vì dùng `LocalStorage` truyền thống. Cơ chế này được thể hiện rõ ở file `frontend/src/context/AuthContext.jsx` và `api.js`.

### Ưu điểm vượt trội:
1. **Chống tấn công XSS (Cross-Site Scripting) tuyệt đối:** Vì Refresh Token nằm trong HttpOnly Cookie, JavaScript của trình duyệt (ngay cả mã độc) cũng KHÔNG THỂ đọc được. Access Token thì nằm trong RAM (React State), biến mất khi tải lại trang, hacker không thể đánh cắp từ LocalStorage.
2. **Bảo mật phiên đăng nhập tối đa:** Khi tải lại trang (F5), ứng dụng gọi ngầm API `/token/refresh/` kèm Cookie HttpOnly để xin Access Token mới. Điều này cho phép thiết lập vòng đời của Access Token rất ngắn (15-30 phút). Nếu lỡ bị lộ, token cũng nhanh chóng hết hạn.
3. **Chống tấn công CSRF (Cross-Site Request Forgery):** Access Token vẫn được lập trình viên đính kèm thủ công vào header `Authorization: Bearer`. Do đó, hacker không thể dùng mánh khoé CSRF để lừa trình duyệt tự động đính kèm quyền xác thực như khi dùng thuần Cookie truyền thống.

### Nhược điểm & Đánh đổi:
1. **Phức tạp trên Mobile App:** Môi trường ứng dụng di động (React Native) không xử lý Cookie giống như trình duyệt Web. Do đó, phía Mobile buộc phải dùng giải pháp thay thế là `AsyncStorage` hoặc hệ thống lưu trữ mã hoá (`SecureStore`).
2. **Khó khăn khi thiết lập Cross-Domain:** Nếu Web và API khác tên miền (domain), cấu hình CORS bắt buộc phải bật `withCredentials: true` và thiết lập thuộc tính `SameSite` cho Cookie cực kỳ khắt khe, dễ gây lỗi khi deploy.
3. **Quản lý State phức tạp:** Đội ngũ Frontend phải viết các "Interceptor" tinh vi để bắt lỗi 401 (hết hạn token), giữ lại các request đang dở dang, gọi ngầm API refresh token, và phát lại request cũ để người dùng không bị văng ra trang đăng nhập một cách đột ngột.

---

## 5. Thiết Kế Cấu Trúc Dữ Liệu (Payload Design)

Để đảm bảo các luồng giao tiếp (API, Redis, WebSocket, FCM) hoạt động trơn tru, cấu trúc dữ liệu JSON (Payload) được thiết kế đồng nhất như sau:

### 5.1 Luồng Gửi Tin Nhắn (REST API Request)
Client gọi `POST /api/messages`. Nếu chỉ gửi text, dùng JSON. Nếu gửi ảnh/video, dùng `multipart/form-data`.
```json
{
  "room_id": "123e4567-e89b-12d3-a456-426614174000",
  "content": "Chào mọi người!",
  "local_id": "nonce-abc-123", // Dùng để dò tìm tin nhắn trên giao diện ảo
  "type": "text" // Các loại: text, image, video, file
}
```

### 5.2 Trả về sau khi lưu DB (REST API Response)
Phản hồi `HTTP 201 Created` ngay lập tức để Client xoá mác "Đang gửi...".
```json
{
  "message_id": "987fcdeb-51a2-43d7-9012-426614174000",
  "local_id": "nonce-abc-123",
  "content": "Chào mọi người!",
  "status": "sent",
  "created_at": "2026-06-11T10:00:00Z"
}
```

### 5.3 Sự Kiện Nội Bộ Django gọi Rust (Redis Pub/Sub Payload)
Django đóng gói toàn bộ thông tin người gửi, đẩy vào kênh `chat_room_<id>` của Redis.
```json
{
  "event": "new_message",
  "room_id": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "message_id": "987fcdeb-51a2-43d7-9012-426614174000",
    "sender": {
      "id": "uuid-user-999",
      "display_name": "Sơn Tùng",
      "avatar": "/media/avatars/sontung.jpg"
    },
    "content": "Chào mọi người!",
    "type": "text",
    "media_url": null,
    "created_at": "2026-06-11T10:00:00Z"
  }
}
```

### 5.4 Sự Kiện Rust báo cho Trình duyệt (WebSocket Broadcast)
Rust WS nhận JSON từ Redis, bọc lại thẻ `type` để Client dễ phân loại sự kiện (vì một phòng chat có thể có nhiều sự kiện như `NEW_MESSAGE`, `USER_TYPING`, `USER_LEFT`), rồi Broadcast đi.
```json
{
  "type": "NEW_MESSAGE",
  "payload": {
    "message_id": "987fcdeb-51a2-43d7-9012-426614174000",
    "sender_name": "Sơn Tùng",
    "content": "Chào mọi người!",
    "media_url": null,
    "created_at": "2026-06-11T10:00:00Z"
  }
}
```

### 5.5 Gói tin Firebase đẩy về Mobile (FCM Push Payload)
Django gọi sang Firebase để "đánh thức" các điện thoại đang khoá màn hình.
```json
{
  "message": {
    "token": "fcm_device_token_xyz_abc",
    "notification": {
      "title": "Sơn Tùng (Nhóm Dự Án)",
      "body": "Chào mọi người!"
    },
    "data": {
      "action": "OPEN_CHAT_ROOM",
      "room_id": "123e4567-e89b-12d3-a456-426614174000",
      "message_id": "987fcdeb-51a2-43d7-9012-426614174000"
    }
  }
}
```

---

## 6. Rủi Ro & Hướng Khắc Phục (Risks & Mitigation)

1. **Rủi ro Nút thắt cổ chai ở Cơ sở dữ liệu (Database Bottleneck):**
   - **Vấn đề:** Khi lượng tin nhắn đạt hàng chục triệu, thao tác INSERT (bước đồng bộ) vào Postgres sẽ bắt đầu chậm lại.
   - **Khắc phục:** Thực hiện **Database Partitioning** (chia bảng `Message` theo từng tháng/năm). Sử dụng Redis Cache để lưu các đoạn chat gần nhất, giảm tải việc truy vấn trực tiếp vào ổ cứng của Postgres.

2. **Rủi ro Nhân đôi tin nhắn (Race Condition trên Frontend Web):**
   - **Vấn đề:** Do xử lý bất đồng bộ, đôi khi Frontend nhận được gói tin báo "Tin nhắn mới" từ WebSocket (Rust) NHANH HƠN cả lúc API RESTful (Django) trả về `201 Created`. Việc này khiến Web vẽ ra 2 tin nhắn giống hệt nhau.
   - **Khắc phục:** Web Frontend tạo ra một mã `local_uuid` (hoặc `nonce`) ngay trước khi gửi API. Khi tin nhắn vòng từ WebSocket về, Frontend kiểm tra mã này, nếu trùng khớp thì hợp nhất (merge) trạng thái thay vì chèn thêm một dòng mới.

3. **Rủi ro Quá tải Worker (Background Task):**
   - **Vấn đề:** Nếu một nhóm chat có 10,000 người, việc kiểm tra xem ai đang Offline và gọi FCM 10,000 lần sẽ làm treo hệ thống hàng đợi bất đồng bộ.
   - **Khắc phục:** Sử dụng Bulk Push Notification (gửi theo nhóm thiết bị/Topic) thay vì lặp qua từng người dùng, đẩy tác vụ ra các Worker Server (Celery) hoàn toàn độc lập với API Server.

4. **Rủi ro Tràn Bộ Nhớ RAM của Redis (OOM - Out of Memory):**
   - **Vấn đề:** Vì Redis chạy 100% trên RAM, nhiều người lo ngại khi có hàng triệu tin nhắn và hàng trăm ngàn kết nối thì RAM server sẽ bị đầy (OOM) dẫn đến sập toàn bộ hệ thống Chat.
   - **Bản chất kỹ thuật:** Tính năng **Redis Pub/Sub** (dùng để bắn tin nhắn từ Django sang Rust) hoạt động theo cơ chế *"Fire and Forget" (Bắn và Quên)*. Nghĩa là Redis **không hề lưu lại** nội dung tin nhắn trên RAM. Nó chỉ làm nhiệm vụ "Bưu điện": nhận gói hàng và giao ngay lập tức cho Rust. Xong là xoá. Do đó, dù có 1 tỷ tin nhắn bay qua thì RAM của Redis cũng không hề tăng lên.
   - **Khắc phục:** Thứ duy nhất tốn RAM trong dự án này là việc lưu cờ trạng thái `Online/Offline` của User. Tuy nhiên, 100,000 User cũng chỉ tiêu tốn khoảng ~15MB RAM. Dù vậy, để hệ thống bất tử, ta bắt buộc phải cấu hình `maxmemory` giới hạn RAM cho Redis (ví dụ: 2GB) và thiết lập chính sách `maxmemory-policy volatile-lru` (Nếu RAM đầy, tự động xoá các key rác, tuyệt đối không được sập Server).
