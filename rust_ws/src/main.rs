// Khai báo các module con
mod models;
mod state;
mod redis_listener;
mod ws;
mod handlers;

use std::collections::HashMap;
use warp::Filter;

#[tokio::main]
async fn main() {
    // 1. Khởi tạo State
    let users = state::init_users();
    
    // 2. Chạy Redis Listener (Background Task)
    let users_for_redis = users.clone();
    tokio::spawn(async move {
        redis_listener::run(users_for_redis).await;
    });

    // 3. Cấu hình WebSocket Route
    let users_filter = warp::any().map(move || users.clone());

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(warp::query::<HashMap<String, String>>())
        .and(users_filter)
        .map(|ws: warp::ws::Ws, params: HashMap<String, String>, users| {
            let username = params.get("username").cloned().unwrap_or_else(|| "guest".to_string());
            
            // Gọi hàm từ module ws
            ws.on_upgrade(move |socket| ws::user_connected(socket, username, users))
        });

    println!("🚀 Rust WebSocket Server started on port 8080");
    warp::serve(ws_route).run(([127, 0, 0, 1], 8080)).await;
}