#!/bin/bash

# Allow overrides from the environment or CLI
NITRO_NODE_VERSION="${NITRO_NODE_VERSION:-v3.7.1-926f1ab}"
TARGET_IMAGE="${TARGET_IMAGE:-offchainlabs/nitro-node:${NITRO_NODE_VERSION}}"

RPC=http://127.0.0.1:8547
PRIVATE_KEY=0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659
CREATE2_FACTORY=0x4e59b44847b379578588920ca78fbf26c0b4956c
SALT=0x0000000000000000000000000000000000000000000000000000000000000000

EXTRA_ARGS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --contract-size)
      shift
      EXTRA_ARGS="${EXTRA_ARGS} --init.dev-max-code-size $1"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Start Nitro dev node in the background
echo "Starting Nitro dev node..."
docker run --rm --name nitro-dev -p 8547:8547 "${TARGET_IMAGE}" --dev --http.addr 0.0.0.0 --http.api=net,web3,eth,debug $EXTRA_ARGS &

# Kill background processes when exiting
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Wait for the node to initialize
echo "Waiting for the Nitro node to initialize..."

until [[ "$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  $RPC)" == *"result"* ]]; do
    sleep 0.1
done


# Check if node is running
curl_output=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  $RPC)

if [[ "$curl_output" == *"result"* ]]; then
  echo "Nitro node is running!"
else
  echo "Failed to start Nitro node."
  exit 1
fi

# Make the caller a chain owner
echo "Setting chain owner to pre-funded dev account..."
cast send 0x00000000000000000000000000000000000000FF "becomeChainOwner()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC

# Set the L1 data fee to 0 so it doesn't impact the L2 Gas limit.
# This makes the gas estimates closer to Ethereum and allows the deployment of the CREATE2 factory
cast send -r $RPC --private-key $PRIVATE_KEY 0x0000000000000000000000000000000000000070 'setL1PricePerUnit(uint256)' 0x0

# Deploy CREATE2 factory
echo "Deploying the CREATE2 factory"
cast send --rpc-url $RPC --private-key $PRIVATE_KEY --value "1 ether" 0x3fab184622dc19b6109349b94811493bf2a45362
cast publish --rpc-url $RPC 0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222
if [ "$(cast code -r $RPC $CREATE2_FACTORY)" == "0x" ]; then
  echo "Failed to deploy CREATE2 factory"
  exit 1
fi

# Deploy Cache Manager Contract
echo "Deploying Cache Manager contract..."
deploy_output=$(cast send --private-key $PRIVATE_KEY \
  --rpc-url $RPC \
  --create 0x60a06040523060805234801561001457600080fd5b50608051611d1c61003060003960006105260152611d1c6000f3fe)

# Extract contract address using awk from plain text output
contract_address=$(echo "$deploy_output" | awk '/contractAddress/ {print $2}')

# Check if contract deployment was successful
if [[ -z "$contract_address" ]]; then
  echo "Error: Failed to extract contract address. Full output:"
  echo "$deploy_output"
  exit 1
fi

echo "Cache Manager contract deployed at address: $contract_address"

# Register the deployed Cache Manager contract
echo "Registering Cache Manager contract as a WASM cache manager..."
registration_output=$(cast send --private-key $PRIVATE_KEY \
  --rpc-url $RPC \
  0x0000000000000000000000000000000000000070 \
  "addWasmCacheManager(address)" "$contract_address")

# Check if registration was successful
if [[ "$registration_output" == *"error"* ]]; then
  echo "Failed to register Cache Manager contract. Registration output:"
  echo "$registration_output"
  exit 1
fi
echo "Cache Manager deployed and registered successfully"

# Deploy StylusDeployer
deployer_code=$(cat ./stylus-deployer-bytecode.txt)
deployer_address=$(cast create2 --salt $SALT --init-code $deployer_code)
cast send --private-key $PRIVATE_KEY --rpc-url $RPC \
    $CREATE2_FACTORY "$SALT$deployer_code"
if [ "$(cast code -r $RPC $deployer_address)" == "0x" ]; then
  echo "Failed to deploy StylusDeployer"
  exit 1
fi
echo "StylusDeployer deployed at address: $deployer_address"

# If no errors, print success message
echo "Nitro node is running..."
wait  # Keep the script alive and the node running
