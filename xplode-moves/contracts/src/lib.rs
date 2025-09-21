use stylus_sdk::{
    alloy_primitives::{U256, Address},
    alloy_sol_types::sol,
    prelude::*,
    storage::{StorageMap, StorageVec, StorageU256},
};

sol! {
    event GameInitialized(string indexed gameId, uint256 gridSize, address gameServer);
    event MoveMade(string indexed gameId, string playerName, uint256 x, uint256 y, uint256 timestamp);
    event GameDelegated(string indexed gameId, address gameServer);
    event GameCommitted(string indexed gameId, address gameServer);

    error GameAlreadyExists();
    error GameNotFound();
    error Unauthorized();
}

#[derive(SolidityError)]
pub enum XplodeError {
    GameAlreadyExists(GameAlreadyExists),
    GameNotFound(GameNotFound),
    Unauthorized(Unauthorized),
}

sol_storage! {
    #[entrypoint]
    pub struct XplodeGame {
        mapping(string => bool) game_exists;
        mapping(string => uint256) grid_sizes;
        mapping(string => address) game_servers;
        mapping(string => bool) is_delegated;
        mapping(string => uint256) move_counts;
        
        // For bomb positions: game_id -> index -> (x, y)
        mapping(string => mapping(uint256 => uint256)) bomb_x;
        mapping(string => mapping(uint256 => uint256)) bomb_y;
        mapping(string => uint256) bomb_counts;
        
        // For moves: game_id -> move_index -> data
        mapping(string => mapping(uint256 => string)) move_players;
        mapping(string => mapping(uint256 => uint256)) move_x;
        mapping(string => mapping(uint256 => uint256)) move_y;
        mapping(string => mapping(uint256 => uint256)) move_timestamps;
    }
}

#[external]
impl XplodeGame {
    pub fn initialize_game(
        &mut self,
        game_id: String,
        grid_size: U256,
        bomb_positions: Vec<(U256, U256)>,
    ) -> Result<(), XplodeError> {
        let sender = msg::sender();

        if self.game_exists.get(game_id.clone()) {
            return Err(XplodeError::GameAlreadyExists(GameAlreadyExists {}));
        }

        // Store game data
        self.game_exists.setter(game_id.clone()).set(true);
        self.grid_sizes.setter(game_id.clone()).set(grid_size);
        self.game_servers.setter(game_id.clone()).set(sender);
        self.is_delegated.setter(game_id.clone()).set(false);
        self.move_counts.setter(game_id.clone()).set(U256::ZERO);

        // Store bomb positions
        let bomb_count = U256::from(bomb_positions.len());
        self.bomb_counts.setter(game_id.clone()).set(bomb_count);
        
        for (i, (x, y)) in bomb_positions.iter().enumerate() {
            let index = U256::from(i);
            self.bomb_x.setter(game_id.clone()).setter(index).set(*x);
            self.bomb_y.setter(game_id.clone()).setter(index).set(*y);
        }

        evm::log(GameInitialized {
            gameId: game_id,
            gridSize: grid_size,
            gameServer: sender,
        });

        Ok(())
    }

    pub fn record_move(
        &mut self,
        game_id: String,
        player_name: String,
        x: U256,
        y: U256,
    ) -> Result<(), XplodeError> {
        if !self.game_exists.get(game_id.clone()) {
            return Err(XplodeError::GameNotFound(GameNotFound {}));
        }

        let move_index = self.move_counts.get(game_id.clone());
        
        // Store move data
        self.move_players.setter(game_id.clone()).setter(move_index).set(player_name.clone());
        self.move_x.setter(game_id.clone()).setter(move_index).set(x);
        self.move_y.setter(game_id.clone()).setter(move_index).set(y);
        self.move_timestamps.setter(game_id.clone()).setter(move_index).set(U256::from(block::timestamp()));

        // Increment move count
        self.move_counts.setter(game_id.clone()).set(move_index + U256::from(1));

        evm::log(MoveMade {
            gameId: game_id,
            playerName: player_name,
            x,
            y,
            timestamp: U256::from(block::timestamp()),
        });

        Ok(())
    }

    pub fn delegate_game(&mut self, game_id: String) -> Result<(), XplodeError> {
        let sender = msg::sender();

        if !self.game_exists.get(game_id.clone()) {
            return Err(XplodeError::GameNotFound(GameNotFound {}));
        }

        if self.game_servers.get(game_id.clone()) != sender {
            return Err(XplodeError::Unauthorized(Unauthorized {}));
        }

        self.is_delegated.setter(game_id.clone()).set(true);

        evm::log(GameDelegated {
            gameId: game_id,
            gameServer: sender,
        });

        Ok(())
    }

    pub fn commit_and_undelegate_game(&mut self, game_id: String) -> Result<(), XplodeError> {
        if !self.game_exists.get(game_id.clone()) {
            return Err(XplodeError::GameNotFound(GameNotFound {}));
        }

        self.is_delegated.setter(game_id.clone()).set(false);

        evm::log(GameCommitted {
            gameId: game_id,
            gameServer: msg::sender(),
        });

        Ok(())
    }

    pub fn game_exists(&self, game_id: String) -> bool {
        self.game_exists.get(game_id)
    }
}