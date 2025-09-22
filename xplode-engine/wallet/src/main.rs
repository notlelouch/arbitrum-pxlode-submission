use std::env;

use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpResponse, HttpServer, Responder};
use common::{
    db,
    models::{LeaderboardEntry, User, UserNetworkPnl, Wallet},
    utils::{
        self, Currency, DepositRequest, Network, UserDetailsRequest, WalletType, WithdrawRequest,
    },
};
use db::establish_connection;
use deposits::sol::DepositService;
use dotenv::dotenv;

use serde_json::json;
use sqlx::{Pool, Postgres};
use tracing::info;
use tracing_subscriber::EnvFilter;
use utils::TxType;

const SOL_TO_LAMPORTS: u64 = 1_000_000_000;

#[actix_web::post("/user-details")]
async fn fetch_or_create_user(
    req: web::Json<UserDetailsRequest>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let AppState {
        pool,
        deposit_service,
    } = &**app_state;
    let mut tx = pool.begin().await.expect("Failed to start transaction");

    // Check if the user already exists
    let existing_user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(&mut *tx)
        .await
        .expect("Error fetching user");

    match existing_user {
        Some(user) => {
            let wallet: Wallet =
                sqlx::query_as("SELECT * FROM wallet WHERE user_id = $1 AND currency = $2")
                    .bind(user.id)
                    .bind(Currency::SOL.to_string())
                    .fetch_one(&mut *tx)
                    .await
                    .expect("Error fetching wallet");

            tx.commit().await.expect("Failed to commit transaction");

            HttpResponse::Ok().json(json!({
                "id": user.id,
                "currency": "SOL",
                "balance": wallet.balance,
                "wallet_type": wallet.wallet_type,
                "wallet_address": wallet.wallet_address,
                "user_pda": user.user_pda
            }))
        }
        None => {
            let user_pda = deposit_service
                .generate_deposit_address()
                .unwrap()
                .to_string();

            // Create new user
            let created_user: User = sqlx::query_as(
                "INSERT INTO users (clerk_id, email, name, user_pda) VALUES ($1, $2, $3, $4) RETURNING *",
            )
            .bind(&req.clerk_id)
            .bind(&req.email)
            .bind(&req.name)
            .bind(user_pda)
            .fetch_one(&mut *tx)
            .await
            .expect("Error creating new user");

            // Create wallet with direct type
            let _: Wallet = sqlx::query_as(
                "INSERT INTO wallet (user_id, currency, balance, wallet_type) VALUES ($1, $2, $3, $4) RETURNING *",
            )
            .bind(created_user.id)
            .bind(Currency::SOL.to_string())
            .bind(0.0)
            .bind(WalletType::PDA.to_string())
            .fetch_one(&mut *tx)
            .await
            .expect("Failed to create wallet");

            tx.commit().await.expect("Failed to commit transaction");

            HttpResponse::Created().json(json!({
                "user_id": created_user.id,
                "currency": "SOL",
                "balance": 0.0,
                "wallet_type": WalletType::PDA.to_string(),
                "wallet_address": "None"
            }))
        }
    }
}

#[actix_web::get("/user-stats/{user_id}")]
async fn get_user_stats(
    user_id: web::Path<String>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let user_id: i32 = user_id.into_inner().parse().unwrap();
    let AppState {
        pool,
        deposit_service: _,
    } = &**app_state;

    let mut tx = pool.begin().await.expect("Failed to start transaction");

    // Use LEFT JOIN to handle case where user has no PNL records yet
    let user_pnl: Option<UserNetworkPnl> =
        sqlx::query_as("SELECT * FROM user_network_pnl WHERE user_id = $1 AND network = $2")
            .bind(user_id)
            .bind(Network::SOLANA.to_string())
            .fetch_optional(&mut *tx)
            .await
            .expect("Error fetching user PNL");

    tx.commit().await.expect("Failed to commit transaction");

    match user_pnl {
        Some(pnl) => HttpResponse::Ok().json(pnl),
        None => HttpResponse::Ok().json(json!({
            "user_id": user_id,
            "network": Network::SOLANA.to_string(),
            "total_matches": 0,
            "total_profit": 0.0
        })),
    }
}

#[actix_web::get("/leaderboard/{network}/{timeframe}")]
async fn get_leaderboard(
    path: web::Path<(String, String)>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let (network, timeframe) = path.into_inner();
    let AppState {
        pool,
        deposit_service: _,
    } = &**app_state;

    let leaders: Vec<LeaderboardEntry> = match timeframe.as_str() {
        "24h" => db::get_leaderboard_24h(pool, &network, 100)
            .await
            .expect("Failed to fetch leaderboard"),
        "all" => db::get_leaderboard_all_time(pool, &network, 100)
            .await
            .expect("Failed to fetch leaderboard"),
        _ => return HttpResponse::BadRequest().body("Invalid timeframe"),
    };

    HttpResponse::Ok().json(leaders)
}

#[actix_web::get("/health")]
async fn health_check() -> impl Responder {
    info!("Health check request arrived");
    HttpResponse::Ok().content_type("text/plain").body("OK")
}

#[actix_web::post("/deposit")]
async fn deposit(
    deposit_request: web::Json<DepositRequest>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let AppState {
        pool,
        deposit_service: _,
    } = &**app_state;
    info!("Deposit request arrived");

    let mut tx = pool.begin().await.expect("Failed to start transaction");

    let wallet: Wallet =
        sqlx::query_as("SELECT * FROM wallet WHERE user_id = $1 AND currency = $2")
            .bind(deposit_request.user_id)
            .bind(deposit_request.currency.to_string())
            .fetch_one(&mut *tx)
            .await
            .expect("Error fetching wallet");

    let new_balance = deposit_request.amount + wallet.balance;

    sqlx::query(
        "UPDATE wallet SET balance = $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3",
    )
    .bind(new_balance)
    .bind(deposit_request.user_id)
    .bind(deposit_request.currency.to_string())
    .execute(&mut *tx)
    .await
    .expect("Error updating wallet balance");

    // Record the transaction
    sqlx::query(
        "INSERT INTO transactions (user_id, amount, currency, tx_type, tx_hash) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(deposit_request.user_id)
    .bind(deposit_request.amount)
    .bind(deposit_request.currency.to_string())
    .bind(TxType::DEPOSIT.to_string())
    .bind(&deposit_request.tx_hash)
    .execute(&mut *tx)
    .await
    .expect("Error recording transaction");

    tx.commit().await.expect("Failed to commit transaction");

    HttpResponse::Ok().json(json!({
        "user_id": deposit_request.user_id,
        "currency": deposit_request.currency,
        "balance": new_balance,
        "tx_hash": deposit_request.tx_hash
    }))
}

#[actix_web::post("/withdraw")]
async fn withdraw(
    withdraw_req: web::Json<WithdrawRequest>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let AppState {
        pool,
        deposit_service,
    } = &**app_state;
    info!("Attempting to withdraw");

    let mut tx = pool.begin().await.expect("Failed to start transaction");

    let wallet: Wallet =
        sqlx::query_as("SELECT * FROM wallet WHERE user_id = $1 AND currency = $2")
            .bind(withdraw_req.user_id)
            .bind(withdraw_req.currency.to_string())
            .fetch_one(&mut *tx)
            .await
            .expect("Error fetching wallet");

    if withdraw_req.amount > wallet.balance {
        return HttpResponse::BadRequest().body("Insufficient balance");
    }

    let withdraw_txhash = deposit_service
        .withdraw_to_user_from_treasury(
            withdraw_req.withdraw_address.clone(),
            (withdraw_req.amount * SOL_TO_LAMPORTS as f64) as u64,
        )
        .await
        .unwrap();

    let new_balance = wallet.balance - withdraw_req.amount;

    // Update the user's wallet balance
    sqlx::query(
        "UPDATE wallet SET balance = $1, updated_at = NOW() WHERE user_id = $2 AND currency = $3",
    )
    .bind(new_balance)
    .bind(withdraw_req.user_id)
    .bind(withdraw_req.currency.to_string())
    .execute(&mut *tx)
    .await
    .expect("Error updating wallet balance");

    // Record the transaction
    sqlx::query(
        "INSERT INTO transactions (user_id, amount, currency, tx_type, tx_hash) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(withdraw_req.user_id)
    .bind(withdraw_req.amount)
    .bind(withdraw_req.currency.to_string())
    .bind(TxType::WITHDRAWAL.to_string())
    .bind(&withdraw_txhash)
    .execute(&mut *tx)
    .await
    .expect("Error recording transaction");

    tx.commit().await.expect("Failed to commit transaction");

    HttpResponse::Ok().json(json!({
        "user_id": withdraw_req.user_id,
        "currency": withdraw_req.currency,
        "balance": new_balance,
        "tx_hash": withdraw_txhash,
        "withdraw_address": withdraw_req.withdraw_address
    }))
}

struct AppState {
    pool: Pool<Postgres>,
    deposit_service: DepositService,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    info!("Starting the wallet");

    info!("Current working directory: {:?}", env::current_dir());
    let pool = establish_connection().await;

    let program_id = env::var("PROGRAM_ID").unwrap();

    let cwd = std::env::current_dir().unwrap();
    let deposit_service =
        DepositService::new(cwd.join("treasury-keypair.json"), program_id.to_string());

    let app_state = web::Data::new(AppState {
        pool,
        deposit_service,
    });

    info!("Starting HTTP server on 0.0.0.0:8080");
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .wrap(Logger::default())
            .wrap(Cors::permissive())
            .service(health_check)
            .service(deposit)
            .service(withdraw)
            .service(fetch_or_create_user)
            .service(get_user_stats)
            .service(get_leaderboard)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

// async fn start_account_watchers(pool: sqlx::Pool<sqlx::Sqlite>, tx: mpsc::Sender<Pubkey>) {
//     let mut conn = pool.acquire().await.expect("DB Connection failed");

//     loop
//     let users: Vec<User> = sqlx::query_as("SELECT user_pda FROM users")
//         .fetch_all(&mut conn)
//         .await
//         .expect("Failed to fetch users");

//     for user in users {
//         let account_pubkey = Pubkey::from_str(&user.user_pda).expect("Invalid pubkey");
//         tx.send(account_pubkey)
//             .await
//             .expect("Failed to send account to channel");
//     }
// }
