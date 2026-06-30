# Stage 1: Build dependencies and binary
FROM rust:slim-bookworm as builder

WORKDIR /usr/src/app

# Cài đặt pkg-config và openssl để build một số crate mạng (nếu cần)
RUN apt-get update && apt-get install -y pkg-config libssl-dev

# Copy manifests để cache dependencies
COPY Cargo.toml Cargo.lock* ./

# Tạo dummy source để tải và biên dịch dependencies
RUN mkdir src && \
    echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy real source code
COPY . .

# Build application thực tế (nó sẽ sử dụng cache của bước trên)
# Chú ý: touch main.rs để cargo biết source code đã thay đổi
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime (Slim)
FROM debian:bookworm-slim

WORKDIR /app

# Cài đặt openssl cho runtime (thường các crate liên quan mạng sẽ cần)
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy binary từ builder stage
COPY --from=builder /usr/src/app/target/release/rust_ws /usr/local/bin/rust_ws

EXPOSE 8080

CMD ["rust_ws"]
