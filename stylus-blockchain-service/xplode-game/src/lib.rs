#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use stylus_sdk::{
    alloy_primitives::{U256, FixedBytes},
    alloy_sol_types::sol,
    prelude::*,
    storage::{StorageMap, StorageU256, StorageBool},
};

sol! {
    event GameInitialized(bytes32 indexed gameId, uint256 gridSize, address gameServer);
    event MoveMade(bytes32 indexed gameId, string playerName, uint256 x, uint256 y, uint256 timestamp);
    event GameDelegated(bytes32 indexed gameId, address gameServer);
    event GameCommitted(bytes32 indexed gameId, address gameServer);
}

sol_storage! {
    #[entrypoint]
    pub struct XplodeGame {
        mapping(bytes32 => bool) game_exists;
        mapping(bytes32 => uint256) grid_sizes;
        mapping(bytes32 => address) game_servers;
        mapping(bytes32 => bool) is_delegated;
        mapping(bytes32 => uint256) move_counts;
        mapping(bytes32 => uint256) bomb_counts;
        
        // Bomb positions: game_id => index => x or y
        mapping(bytes32 => mapping(uint256 => uint256)) bomb_x;
        mapping(bytes32 => mapping(uint256 => uint256)) bomb_y;
        
        // Moves: game_id => move_index => data
        mapping(bytes32 => mapping(uint256 => uint256)) move_x;
        mapping(bytes32 => mapping(uint256 => uint256)) move_y;
        mapping(bytes32 => mapping(uint256 => uint256)) move_timestamps;
    }
}

// Helper function to convert string to bytes32
fn string_to_bytes32(s: &str) -> FixedBytes<32> {
    let mut bytes = [0u8; 32];
    let s_bytes = s.as_bytes();
    let len = s_bytes.len().min(32);
    bytes[..len].copy_from_slice(&s_bytes[..len]);
    FixedBytes::from(bytes)
}

#[public]
impl XplodeGame {
    pub fn initialize_game(
        &mut self,
        game_id: String,
        grid_size: U256,
        bomb_positions: Vec<(U256, U256)>,
    ) {
        let sender = self.vm().msg_sender();
        let game_id_bytes = string_to_bytes32(&game_id);

        if self.game_exists.get(game_id_bytes) {
            return; // Game already exists
        }

        self.game_exists.setter(game_id_bytes).set(true);
        self.grid_sizes.setter(game_id_bytes).set(grid_size);
        self.game_servers.setter(game_id_bytes).set(sender);
        self.is_delegated.setter(game_id_bytes).set(false);
        self.move_counts.setter(game_id_bytes).set(U256::ZERO);

        let bomb_count = U256::from(bomb_positions.len());
        self.bomb_counts.setter(game_id_bytes).set(bomb_count);
        
        for (i, (x, y)) in bomb_positions.iter().enumerate() {
            let index = U256::from(i);
            self.bomb_x.setter(game_id_bytes).setter(index).set(*x);
            self.bomb_y.setter(game_id_bytes).setter(index).set(*y);
        }

        stylus_sdk::stylus_core::log(self.vm(), GameInitialized {
            gameId: game_id_bytes,
            gridSize: grid_size,
            gameServer: sender,
        });
    }

    pub fn record_move(
        &mut self,
        game_id: String,
        player_name: String,
        x: U256,
        y: U256,
    ) {
        let game_id_bytes = string_to_bytes32(&game_id);

        if !self.game_exists.get(game_id_bytes) {
            return; // Game doesn't exist
        }

        let move_index = self.move_counts.get(game_id_bytes);
        let timestamp = U256::from(self.vm().block_timestamp());
        
        self.move_x.setter(game_id_bytes).setter(move_index).set(x);
        self.move_y.setter(game_id_bytes).setter(move_index).set(y);
        self.move_timestamps.setter(game_id_bytes).setter(move_index).set(timestamp);

        self.move_counts.setter(game_id_bytes).set(move_index + U256::from(1));

        stylus_sdk::stylus_core::log(self.vm(), MoveMade {
            gameId: game_id_bytes,
            playerName: player_name,
            x,
            y,
            timestamp,
        });
    }

    pub fn delegate_game(&mut self, game_id: String) {
        let sender = self.vm().msg_sender();
        let game_id_bytes = string_to_bytes32(&game_id);

        if !self.game_exists.get(game_id_bytes) {
            return; // Game doesn't exist
        }

        if self.game_servers.get(game_id_bytes) != sender {
            return; // Unauthorized
        }

        self.is_delegated.setter(game_id_bytes).set(true);

        stylus_sdk::stylus_core::log(self.vm(), GameDelegated {
            gameId: game_id_bytes,
            gameServer: sender,
        });
    }

    pub fn commit_and_undelegate_game(&mut self, game_id: String) {
        let game_id_bytes = string_to_bytes32(&game_id);

        if !self.game_exists.get(game_id_bytes) {
            return; // Game doesn't exist
        }

        self.is_delegated.setter(game_id_bytes).set(false);

        stylus_sdk::stylus_core::log(self.vm(), GameCommitted {
            gameId: game_id_bytes,
            gameServer: self.vm().msg_sender(),
        });
    }

    pub fn game_exists(&self, game_id: String) -> bool {
        let game_id_bytes = string_to_bytes32(&game_id);
        self.game_exists.get(game_id_bytes)
    }

    pub fn get_grid_size(&self, game_id: String) -> U256 {
        let game_id_bytes = string_to_bytes32(&game_id);
        self.grid_sizes.get(game_id_bytes)
    }

    pub fn get_move_count(&self, game_id: String) -> U256 {
        let game_id_bytes = string_to_bytes32(&game_id);
        self.move_counts.get(game_id_bytes)
    }
}