// src/ws.rs
use crate::state::Users;
use crate::handlers::handle_incoming_message; // <--- IMPORT HÀM XỬ LÝ
use futures::{StreamExt, SinkExt};
use tokio::sync::mpsc;
use warp::ws::{WebSocket}; // Bỏ Message ở đây vì không dùng trực tiếp nữa

pub async fn user_connected(ws: WebSocket, username: String, users: Users) {
    println!("🔌 User connected: {}", username);

    let (mut user_ws_tx, mut user_ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // 1. Lưu user vào state
    users.lock().unwrap().insert(username.clone(), tx);

    // 2. Task gửi tin đi (System -> User)
    tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if let Err(e) = user_ws_tx.send(message).await {
                eprintln!("websocket send error: {}", e);
                break;
            }
        }
    });

    // 3. Loop nhận tin đến (User -> System)
    while let Some(result) = user_ws_rx.next().await {
        match result {
            Ok(msg) => {
                // Gọi hàm xử lý logic từ file handlers.rs
                let should_continue = handle_incoming_message(msg, &username).await;
                if !should_continue {
                    break;
                }
            }
            Err(e) => {
                eprintln!("websocket error(uid={}): {}", username, e);
                break;
            }
        }
    }

    // 4. Cleanup
    println!("❌ User disconnected: {}", username);
    users.lock().unwrap().remove(&username);
}