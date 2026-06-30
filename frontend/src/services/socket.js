// Ví dụ trong config.js
export const API_URL = import.meta.env.VITE_API_URL 
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL 

class WebSocketService {
    static instance = null;

    // Đảm bảo chỉ có 1 instance duy nhất (Singleton)
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    constructor() {
        this.socketRef = null;
        this.reconnectTimeout = null;
        this.username = null; // Lưu username để reconnect nếu rớt mạng
        
        // Cấu hình URL Socket (Rust Backend chạy port 8080)
        // Bạn có thể đưa vào biến môi trường: import.meta.env.VITE_SOCKET_URL
        this.baseUrl = SOCKET_URL; 
    }

    // Hàm kết nối chính
    connect(username) {
        // Nếu không có username hoặc đang kết nối/đã kết nối thì bỏ qua
        if (!username) return;
        if (this.socketRef && (this.socketRef.readyState === WebSocket.OPEN || this.socketRef.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.username = username;
        const wsUrl = `${this.baseUrl}?username=${username}`;

        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
        this.socketRef = new WebSocket(wsUrl);

        // --- Xử lý sự kiện ---

        this.socketRef.onopen = () => {
            console.log(`✅ Global WebSocket Connected: ${username}`);
            // Xóa timeout reconnect cũ nếu có
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        };

        this.socketRef.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 🔥 Bắn sự kiện 'chat-update' ra toàn Window (giữ nguyên logic cũ)
                // Các hook hoặc component sẽ lắng nghe sự kiện này
                const globalEvent = new CustomEvent('chat-update', { detail: data });
                window.dispatchEvent(globalEvent);
                
            } catch (e) {
                console.error("Error parsing WS message", e);
            }
        };

        this.socketRef.onclose = () => {
            console.log("❌ WebSocket Disconnected");
            this.socketRef = null;

            // Tự động kết nối lại sau 3s nếu bị rớt mạng
            this.reconnectTimeout = setTimeout(() => {
                console.log("🔄 Attempting to reconnect...");
                this.connect(this.username);
            }, 3000);
        };

        this.socketRef.onerror = (error) => {
            console.error("WebSocket Error:", error);
            this.socketRef.close();
        };
    }

    // Hàm gửi tin nhắn (nếu cần gửi từ client lên server qua socket)
    send(data) {
        if (this.socketRef && this.socketRef.readyState === WebSocket.OPEN) {
            this.socketRef.send(JSON.stringify(data));
        } else {
            console.warn("WebSocket not connected. Cannot send.");
        }
    }

    // Hàm ngắt kết nối (dùng khi Logout)
    disconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.socketRef) {
            this.socketRef.close();
            this.socketRef = null;
        }
        this.username = null;
    }
}

const socketService = WebSocketService.getInstance();
export default socketService;